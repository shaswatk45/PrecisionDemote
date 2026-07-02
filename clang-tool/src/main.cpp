///============================================================================
/// precision-demote  —  Clang LibTooling FP32 → FP16 Demotion Tool
///
/// A real Clang AST-based analyzer that:
///   1. Traverses the AST using RecursiveASTVisitor
///   2. Detects float variable declarations and arithmetic expressions
///   3. Builds computation dependency graphs per function
///   4. Applies heuristic precision-demotion rules
///   5. Rewrites safe float decls to __fp16 using clang::Rewriter
///   6. Outputs JSON analysis + transformed source
///
/// Build:
///   mkdir build && cd build
///   cmake .. -DLLVM_DIR=/usr/lib/llvm-18/lib/cmake/llvm \
///            -DClang_DIR=/usr/lib/llvm-18/lib/cmake/clang
///   make -j$(nproc)
///
/// Usage:
///   ./precision-demote input.cpp -- -std=c++17
///   ./precision-demote input.cpp --output-json result.json -- -std=c++17
///   ./precision-demote input.cpp --dry-run -- -std=c++17
///============================================================================

#include "clang/AST/AST.h"
#include "clang/AST/ASTConsumer.h"
#include "clang/AST/RecursiveASTVisitor.h"
#include "clang/AST/ParentMapContext.h"
#include "clang/Basic/SourceManager.h"
#include "clang/Frontend/CompilerInstance.h"
#include "clang/Frontend/FrontendAction.h"
#include "clang/Lex/Lexer.h"
#include "clang/Rewrite/Core/Rewriter.h"
#include "clang/Tooling/CommonOptionsParser.h"
#include "clang/Tooling/Tooling.h"
#include "llvm/Support/CommandLine.h"
#include "llvm/Support/JSON.h"
#include "llvm/Support/raw_ostream.h"

#include <algorithm>
#include <fstream>
#include <map>
#include <memory>
#include <queue>
#include <set>
#include <string>
#include <vector>

using namespace clang;
using namespace clang::tooling;

/// Tool version — bumped for the v2.0 analysis overhaul (blockReason reporting,
/// double-type tracking, self-describing JSON schema).
#define PD_VERSION "2.0.0"

///=== CLI Options ============================================================
static llvm::cl::OptionCategory ToolCat("precision-demote options");

static llvm::cl::opt<std::string> OutputJSON(
    "output-json",
    llvm::cl::desc("Path for JSON output (default: analysis.json)"),
    llvm::cl::init("analysis.json"), llvm::cl::cat(ToolCat));

static llvm::cl::opt<bool> DryRun(
    "dry-run",
    llvm::cl::desc("Analyze only — do not rewrite source"),
    llvm::cl::init(false), llvm::cl::cat(ToolCat));

static llvm::cl::opt<int> MaxDepth(
    "max-depth",
    llvm::cl::desc("Max arithmetic chain depth for safe demotion (default 3)"),
    llvm::cl::init(3), llvm::cl::cat(ToolCat));

static llvm::cl::opt<int> MaxFanIn(
    "max-fan-in",
    llvm::cl::desc("Max dependency fan-in for safe demotion (default 5)"),
    llvm::cl::init(5), llvm::cl::cat(ToolCat));

///=== Data Structures ========================================================

/// One floating-point variable node in the dependency graph.
struct FPNode {
    std::string name;           // variable name
    std::string qualType;       // qualified type string (e.g. "float")
    unsigned    line = 0;       // source line number
    unsigned    col  = 0;       // source column
    int         depth = 0;      // arithmetic expression depth of initializer
    bool        hasDivision = false;
    int         depCount = 0;   // number of float operand deps
    bool        isAccumulator = false; // detected +=, -=, etc.
    bool        isSafe = false; // heuristic verdict
    std::string blockReason;    // "" if safe, else the first rule that blocked it
    SourceRange typeRange;      // range of the type token for rewriting
    std::vector<std::string> deps; // names of float vars this depends on
};

/// Per-function analysis result.
struct FuncResult {
    std::string name;
    std::vector<FPNode> nodes;
    std::vector<std::pair<std::string,std::string>> edges;
    int totalFloatVars = 0;
    int safeToDemote   = 0;
};

/// Global analysis state (filled by the ASTConsumer, read by main).
static std::vector<FuncResult> GResults;
static std::string             GOriginalSource;
static std::string             GRewrittenSource;

///=== Expression Helpers =====================================================

/// Recursively compute the arithmetic depth of a Clang Expr.
static int computeExprDepth(const Expr *E) {
    if (!E) return 0;
    E = E->IgnoreParenImpCasts();

    if (const auto *BO = dyn_cast<BinaryOperator>(E)) {
        if (BO->isAdditiveOp() || BO->isMultiplicativeOp() ||
            BO->getOpcode() == BO_Rem) {
            return 1 + std::max(computeExprDepth(BO->getLHS()),
                                computeExprDepth(BO->getRHS()));
        }
        // Comparison, comma, assignment — don't count as arithmetic
        return std::max(computeExprDepth(BO->getLHS()),
                        computeExprDepth(BO->getRHS()));
    }
    if (const auto *CO = dyn_cast<ConditionalOperator>(E)) {
        return std::max(computeExprDepth(CO->getTrueExpr()),
                        computeExprDepth(CO->getFalseExpr()));
    }
    if (const auto *UO = dyn_cast<UnaryOperator>(E)) {
        return computeExprDepth(UO->getSubExpr());
    }
    if (const auto *CE = dyn_cast<CallExpr>(E)) {
        // Treat math function calls as depth-1 operations
        int maxArg = 0;
        for (unsigned i = 0; i < CE->getNumArgs(); i++)
            maxArg = std::max(maxArg, computeExprDepth(CE->getArg(i)));
        return 1 + maxArg;
    }
    return 0; // leaf (DeclRefExpr, literal, etc.)
}

/// Check if an expression contains any division operator.
static bool exprContainsDivision(const Expr *E) {
    if (!E) return false;
    E = E->IgnoreParenImpCasts();

    if (const auto *BO = dyn_cast<BinaryOperator>(E)) {
        if (BO->getOpcode() == BO_Div || BO->getOpcode() == BO_Rem)
            return true;
        return exprContainsDivision(BO->getLHS()) ||
               exprContainsDivision(BO->getRHS());
    }
    if (const auto *UO = dyn_cast<UnaryOperator>(E))
        return exprContainsDivision(UO->getSubExpr());
    if (const auto *CE = dyn_cast<CallExpr>(E)) {
        for (unsigned i = 0; i < CE->getNumArgs(); i++)
            if (exprContainsDivision(CE->getArg(i))) return true;
    }
    if (const auto *CO = dyn_cast<ConditionalOperator>(E)) {
        return exprContainsDivision(CO->getCond()) ||
               exprContainsDivision(CO->getTrueExpr()) ||
               exprContainsDivision(CO->getFalseExpr());
    }
    return false;
}

/// Collect all DeclRefExpr names from an expression.
static void collectVarRefs(const Expr *E, std::vector<std::string> &out,
                           const std::set<std::string> &floatVars) {
    if (!E) return;
    E = E->IgnoreParenImpCasts();

    if (const auto *DRE = dyn_cast<DeclRefExpr>(E)) {
        std::string n = DRE->getDecl()->getNameAsString();
        if (floatVars.count(n) &&
            std::find(out.begin(), out.end(), n) == out.end())
            out.push_back(n);
        return;
    }
    if (const auto *BO = dyn_cast<BinaryOperator>(E)) {
        collectVarRefs(BO->getLHS(), out, floatVars);
        collectVarRefs(BO->getRHS(), out, floatVars);
        return;
    }
    if (const auto *UO = dyn_cast<UnaryOperator>(E)) {
        collectVarRefs(UO->getSubExpr(), out, floatVars);
        return;
    }
    if (const auto *CE = dyn_cast<CallExpr>(E)) {
        for (unsigned i = 0; i < CE->getNumArgs(); i++)
            collectVarRefs(CE->getArg(i), out, floatVars);
        return;
    }
    if (const auto *CO = dyn_cast<ConditionalOperator>(E)) {
        collectVarRefs(CO->getCond(), out, floatVars);
        collectVarRefs(CO->getTrueExpr(), out, floatVars);
        collectVarRefs(CO->getFalseExpr(), out, floatVars);
        return;
    }
    if (const auto *ICE = dyn_cast<ImplicitCastExpr>(E)) {
        collectVarRefs(ICE->getSubExpr(), out, floatVars);
        return;
    }
}

///=== Heuristic Engine =======================================================

/// Evaluate the 5 safety rules in priority order and record the *first* rule
/// that blocks demotion in node.blockReason ("" means safe). Returns the safe
/// verdict. Centralising the reason here makes the analyzer the single source
/// of truth — the UI no longer has to re-derive why a variable was kept.
static bool evaluateHeuristics(FPNode &node, int maxDepth, int maxFanIn) {
    // Rule 1: type must be plain float (not double, not pointer)
    if (node.qualType != "float") { node.blockReason = "type"; return false; }

    // Rule 2: accumulator variables are not safe
    if (node.isAccumulator) { node.blockReason = "accumulator"; return false; }

    // Rule 4: no division in chain (reported before depth: a division anywhere
    // in the chain is the more fundamental numerical hazard)
    if (node.hasDivision) { node.blockReason = "division"; return false; }

    // Rule 3: arithmetic depth within limit
    if (node.depth > maxDepth) { node.blockReason = "depth"; return false; }

    // Rule 5: dependency fan-in within limit
    if (node.depCount > maxFanIn) { node.blockReason = "fan-in"; return false; }

    node.blockReason.clear();
    return true;
}

///=== RecursiveASTVisitor ====================================================

class FPVisitor : public RecursiveASTVisitor<FPVisitor> {
public:
    explicit FPVisitor(ASTContext &Ctx) : Ctx_(Ctx), SM_(Ctx.getSourceManager()) {}

    /// Visit every function definition.
    bool VisitFunctionDecl(FunctionDecl *FD) {
        if (!FD->hasBody()) return true;
        if (!SM_.isInMainFile(FD->getLocation())) return true;

        FuncResult fr;
        fr.name = FD->getNameAsString();

        // ── Pass 1: collect all float VarDecls in this function ────────
        std::set<std::string> floatVarNames;
        std::vector<VarDecl *> floatVars;
        std::vector<VarDecl *> doubleVars;

        collectFloatVarsInStmt(FD->getBody(), floatVarNames, floatVars,
                               doubleVars);

        // ── Pass 2: detect accumulation (+=, -=, *=, /=) ──────────────
        std::set<std::string> accumulators;
        detectAccumulators(FD->getBody(), floatVarNames, accumulators);

        // ── Pass 3: build FPNodes with depth, division, deps ───────────
        std::map<std::string, int> varDepthMap; // transitive depth cache

        for (VarDecl *VD : floatVars) {
            FPNode node;
            node.name = VD->getNameAsString();
            node.qualType = VD->getType().getUnqualifiedType().getAsString();
            node.isAccumulator = accumulators.count(node.name) > 0;

            SourceLocation loc = VD->getLocation();
            node.line = SM_.getSpellingLineNumber(loc);
            node.col  = SM_.getSpellingColumnNumber(loc);

            // Type token range for rewriting
            if (VD->getTypeSourceInfo()) {
                TypeLoc TL = VD->getTypeSourceInfo()->getTypeLoc();
                node.typeRange = TL.getSourceRange();
            }

            if (const Expr *Init = VD->getInit()) {
                int exprD = computeExprDepth(Init);
                node.hasDivision = exprContainsDivision(Init);

                // Collect float variable references
                collectVarRefs(Init, node.deps, floatVarNames);
                node.depCount = (int)node.deps.size();

                // Transitive depth: expr depth + max dependency depth
                int maxDD = 0;
                for (auto &dep : node.deps) {
                    auto it = varDepthMap.find(dep);
                    if (it != varDepthMap.end())
                        maxDD = std::max(maxDD, it->second);
                }
                node.depth = exprD + maxDD;

                // Propagate division flag from deps
                if (!node.hasDivision) {
                    for (auto &prevNode : fr.nodes) {
                        for (auto &dep : node.deps) {
                            if (prevNode.name == dep && prevNode.hasDivision) {
                                node.hasDivision = true;
                                break;
                            }
                        }
                        if (node.hasDivision) break;
                    }
                }
            }

            // Apply heuristics
            node.isSafe = evaluateHeuristics(node, MaxDepth, MaxFanIn);

            varDepthMap[node.name] = node.depth;

            // Build edges
            for (auto &dep : node.deps)
                fr.edges.push_back({node.name, dep});

            fr.nodes.push_back(std::move(node));
        }

        // ── Double locals: reported as type-blocked, never demoted ─────
        for (VarDecl *VD : doubleVars) {
            FPNode node;
            node.name = VD->getNameAsString();
            node.qualType = VD->getType().getUnqualifiedType().getAsString();
            node.line = SM_.getSpellingLineNumber(VD->getLocation());
            node.col  = SM_.getSpellingColumnNumber(VD->getLocation());
            node.isSafe = false;
            node.blockReason = "type"; // Rule 1: only FP32 is in scope
            fr.nodes.push_back(std::move(node));
        }

        // Tally
        fr.totalFloatVars = (int)fr.nodes.size();
        fr.safeToDemote = 0;
        for (auto &n : fr.nodes)
            if (n.isSafe) fr.safeToDemote++;

        if (!fr.nodes.empty())
            GResults.push_back(std::move(fr));

        return true;
    }

private:
    ASTContext    &Ctx_;
    SourceManager &SM_;

    /// Recursively collect local floating-point VarDecls inside a Stmt.
    /// Plain `float` scalars go into (names, vars) and drive the dependency
    /// graph. `double` scalars are collected separately so they can be surfaced
    /// in the report as type-blocked (never demoted), without polluting the
    /// float dependency analysis.
    void collectFloatVarsInStmt(Stmt *S,
                                std::set<std::string> &names,
                                std::vector<VarDecl *> &vars,
                                std::vector<VarDecl *> &doubleVars) {
        if (!S) return;

        if (auto *DS = dyn_cast<DeclStmt>(S)) {
            for (Decl *D : DS->decls()) {
                if (auto *VD = dyn_cast<VarDecl>(D)) {
                    if (!VD->hasLocalStorage()) continue;
                    QualType QT = VD->getType();
                    // Scalars only — skip pointers, arrays, references
                    if (!QT->isFloatingType()) continue;
                    if (QT->isPointerType() || QT->isArrayType()) continue;
                    std::string ts = QT.getUnqualifiedType().getAsString();
                    if (ts == "float") {
                        names.insert(VD->getNameAsString());
                        vars.push_back(VD);
                    } else if (ts == "double") {
                        doubleVars.push_back(VD);
                    }
                }
            }
        }

        for (Stmt *Child : S->children())
            if (Child) collectFloatVarsInStmt(Child, names, vars, doubleVars);
    }

    /// Detect which float vars are used as accumulation targets (+=, -=, etc.)
    void detectAccumulators(Stmt *S,
                            const std::set<std::string> &floatVars,
                            std::set<std::string> &accumulators) {
        if (!S) return;

        if (auto *BO = dyn_cast<BinaryOperator>(S)) {
            if (BO->isCompoundAssignmentOp()) {
                if (auto *LHS = dyn_cast<DeclRefExpr>(
                        BO->getLHS()->IgnoreParenImpCasts())) {
                    std::string n = LHS->getDecl()->getNameAsString();
                    if (floatVars.count(n))
                        accumulators.insert(n);
                }
            }
        }

        for (Stmt *Child : S->children())
            if (Child) detectAccumulators(Child, floatVars, accumulators);
    }
};

///=== ASTConsumer ============================================================

class FPConsumer : public ASTConsumer {
public:
    explicit FPConsumer(ASTContext &Ctx, Rewriter &Rw)
        : Visitor_(Ctx), Rw_(Rw), Ctx_(Ctx) {}

    void HandleTranslationUnit(ASTContext &Ctx) override {
        // Run visitor
        Visitor_.TraverseDecl(Ctx.getTranslationUnitDecl());

        // Capture original source
        SourceManager &SM = Ctx.getSourceManager();
        FileID MainFID = SM.getMainFileID();
        auto Buf = SM.getBufferOrNone(MainFID);
        if (Buf)
            GOriginalSource = Buf->getBuffer().str();

        // Rewrite safe nodes (unless dry-run)
        if (!DryRun) {
            for (auto &fr : GResults) {
                for (auto &node : fr.nodes) {
                    if (!node.isSafe) continue;
                    if (!node.typeRange.isValid()) continue;

                    SourceLocation Begin =
                        SM.getSpellingLoc(node.typeRange.getBegin());

                    // Safety: only rewrite if in main file
                    if (!SM.isInMainFile(Begin)) continue;

                    // Measure the "float" token length
                    unsigned TokLen = Lexer::MeasureTokenLength(
                        Begin, SM, Ctx.getLangOpts());

                    // Verify the token is actually "float"
                    const char *TokStart =
                        SM.getCharacterData(Begin);
                    if (TokStart && StringRef(TokStart, TokLen) == "float") {
                        Rw_.ReplaceText(Begin, TokLen, "__fp16");
                    }
                }
            }

            // Extract rewritten buffer
            const RewriteBuffer *RB = Rw_.getRewriteBufferFor(MainFID);
            if (RB) {
                GRewrittenSource = std::string(RB->begin(), RB->end());
            } else {
                GRewrittenSource = GOriginalSource; // no changes
            }
        } else {
            GRewrittenSource = GOriginalSource;
        }
    }

private:
    FPVisitor  Visitor_;
    Rewriter  &Rw_;
    ASTContext &Ctx_;
};

///=== FrontendAction =========================================================

class FPAction : public ASTFrontendAction {
public:
    std::unique_ptr<ASTConsumer>
    CreateASTConsumer(CompilerInstance &CI, StringRef /*File*/) override {
        Rw_.setSourceMgr(CI.getSourceManager(), CI.getLangOpts());
        return std::make_unique<FPConsumer>(CI.getASTContext(), Rw_);
    }

private:
    Rewriter Rw_;
};

///=== JSON Serialisation =====================================================

static void writeJSON(const std::string &Path) {
    llvm::json::Object Root;

    llvm::json::Array FuncsArr;
    for (auto &fr : GResults) {
        llvm::json::Object FObj;
        FObj["name"]           = fr.name;
        FObj["totalFloatVars"] = fr.totalFloatVars;
        FObj["safeToDemote"]   = fr.safeToDemote;

        llvm::json::Array NodesArr;
        for (auto &n : fr.nodes) {
            llvm::json::Object NObj;
            NObj["name"]            = n.name;
            NObj["type"]            = n.qualType;
            NObj["depth"]           = n.depth;
            NObj["hasDivision"]     = n.hasDivision;
            NObj["dependencyCount"] = n.depCount;
            NObj["isAccumulator"]   = n.isAccumulator;
            NObj["isSafe"]          = n.isSafe;
            NObj["blockReason"]     = n.blockReason;
            NObj["line"]            = (int)n.line;
            NObj["col"]             = (int)n.col;

            llvm::json::Array DepsArr;
            for (auto &d : n.deps) DepsArr.push_back(d);
            NObj["deps"] = std::move(DepsArr);

            NodesArr.push_back(std::move(NObj));
        }
        FObj["nodes"] = std::move(NodesArr);

        llvm::json::Array EdgesArr;
        for (auto &e : fr.edges) {
            llvm::json::Object EObj;
            EObj["from"] = e.first;
            EObj["to"]   = e.second;
            EdgesArr.push_back(std::move(EObj));
        }
        FObj["edges"] = std::move(EdgesArr);

        FuncsArr.push_back(std::move(FObj));
    }

    Root["functions"]      = std::move(FuncsArr);
    Root["originalSource"] = GOriginalSource;
    Root["rewrittenSource"]= GRewrittenSource;
    Root["dryRun"]         = DryRun.getValue();

    // Self-describing metadata: lets consumers (backend/UI) render the exact
    // thresholds a report was produced with instead of hard-coding "3" / "5".
    Root["toolVersion"]    = PD_VERSION;
    Root["engine"]         = "clang-ast";
    llvm::json::Object Thresholds;
    Thresholds["maxDepth"]  = MaxDepth.getValue();
    Thresholds["maxFanIn"]  = MaxFanIn.getValue();
    Root["thresholds"]      = std::move(Thresholds);

    std::error_code EC;
    llvm::raw_fd_ostream OS(Path, EC);
    if (EC) {
        llvm::errs() << "Error writing " << Path << ": " << EC.message() << "\n";
        return;
    }
    OS << llvm::json::Value(std::move(Root));
    OS << "\n";

    // Summary to stderr
    int totalV = 0, totalS = 0;
    for (auto &fr : GResults) {
        totalV += fr.totalFloatVars;
        totalS += fr.safeToDemote;
    }
    llvm::errs() << "[precision-demote] Version:            "
                 << PD_VERSION << "\n";
    llvm::errs() << "[precision-demote] Functions analyzed: "
                 << GResults.size() << "\n";
    llvm::errs() << "[precision-demote] Float variables:    "
                 << totalV << "\n";
    llvm::errs() << "[precision-demote] Safe to demote:     "
                 << totalS << " / " << totalV << "\n";
    llvm::errs() << "[precision-demote] JSON written to:    "
                 << Path << "\n";
}

///=== main ===================================================================

int main(int argc, const char **argv) {
    auto ExpParser = CommonOptionsParser::create(argc, argv, ToolCat,
                         llvm::cl::ZeroOrMore,
                         "Precision-Aware Type Demotion Tool\n"
                         "Analyzes float computation chains and demotes safe "
                         "variables to __fp16.\n");
    if (!ExpParser) {
        llvm::errs() << ExpParser.takeError();
        return 1;
    }
    CommonOptionsParser &OP = ExpParser.get();
    ClangTool Tool(OP.getCompilations(), OP.getSourcePathList());

    int Ret = Tool.run(newFrontendActionFactory<FPAction>().get());

    writeJSON(OutputJSON.getValue());

    return Ret;
}
