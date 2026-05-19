const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { execSync } = require('child_process');

const app = express();
const PORT = process.env.PORT || 4000;
const WSL_DISTRO = process.env.WSL_DISTRO || 'Ubuntu';
const TOOL_WIN_PATH = path.resolve(__dirname, '../clang-tool/build/precision-demote');
const TOOL_WSL_PATH = process.env.TOOL_WSL_PATH || toWSLPath(TOOL_WIN_PATH);
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');
const OUTPUT_DIR = path.resolve(__dirname, 'outputs');

fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(OUTPUT_DIR);

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  filename: (req, file, cb) => cb(null, `${uuidv4()}-${file.originalname}`),
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = /\.(c|cpp|cc|cxx|h|hpp)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only C/C++ files are allowed'), ok);
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

function toWSLPath(winPath) {
  const resolved = path.resolve(winPath);
  const drive = resolved[0].toLowerCase();
  const rest = resolved.slice(2).replace(/\\/g, '/');
  return `/mnt/${drive}${rest}`;
}

function isToolAvailable() {
  try {
    execSync(`wsl -d ${WSL_DISTRO} -- test -x "${TOOL_WSL_PATH}"`, {
      stdio: 'pipe',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

function runClangTool(srcPath, outputJsonPath) {
  const wslSrc = toWSLPath(srcPath);
  const wslOut = toWSLPath(outputJsonPath);
  const cmd = `wsl -d ${WSL_DISTRO} -- "${TOOL_WSL_PATH}" "${wslSrc}" --output-json "${wslOut}" -- -std=c++17`;

  try {
    const stdout = execSync(cmd, {
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (stdout.trim()) console.log('[tool]', stdout.trim());
  } catch (err) {
    console.warn('[tool] failed:', err.stderr || err.message);
  }

  if (!fs.existsSync(outputJsonPath)) return null;
  try {
    return fs.readJsonSync(outputJsonPath);
  } catch (err) {
    console.error('[tool] failed to parse JSON:', err.message);
    return null;
  }
}

function stripComments(sourceCode) {
  return sourceCode
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

function splitFunctions(sourceCode, filename) {
  const code = stripComments(sourceCode);
  const headerRe = /(?:^|[\n;{}])\s*(?:static\s+|inline\s+|extern\s+)?[\w:*&<>\s]+\s+([A-Za-z_]\w*)\s*\([^;{}]*\)\s*\{/g;
  const functions = [];
  let match;

  while ((match = headerRe.exec(code)) !== null) {
    const name = match[1];
    if (['if', 'for', 'while', 'switch', 'catch'].includes(name)) continue;
    const bodyStart = headerRe.lastIndex;
    let depth = 1;
    let i = bodyStart;
    for (; i < code.length && depth > 0; i++) {
      if (code[i] === '{') depth++;
      if (code[i] === '}') depth--;
    }
    functions.push({ name, body: code.slice(bodyStart, i - 1) });
    headerRe.lastIndex = i;
  }

  if (functions.length) return functions;
  return [{ name: filename.replace(/\.(c|cpp|cc|cxx|h|hpp)$/i, ''), body: code }];
}

function expressionDepth(expr) {
  if (!expr) return 0;
  const ops = expr.match(/[+\-*/%]/g) || [];
  return ops.length;
}

function fallbackAnalysis(sourceCode, filename) {
  const functions = splitFunctions(sourceCode, filename).map((fn) => {
    const declRe = /\bfloat\s+([A-Za-z_]\w*)\s*(?:=\s*([^;]+))?;/g;
    const accumRe = /\b([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=)/g;
    const accumulators = new Set();
    let match;

    while ((match = accumRe.exec(fn.body)) !== null) {
      accumulators.add(match[1]);
    }

    const raw = [];
    while ((match = declRe.exec(fn.body)) !== null) {
      raw.push({ name: match[1], initExpr: match[2] || '', index: match.index });
    }

    const floatNames = new Set(raw.map((n) => n.name));
    const depthByName = new Map();
    const divisionByName = new Map();
    const nodes = raw.map((item) => {
      const words = item.initExpr.match(/\b[A-Za-z_]\w*\b/g) || [];
      const deps = [...new Set(words.filter((w) => floatNames.has(w) && w !== item.name))];
      const depDepth = deps.reduce((max, dep) => Math.max(max, depthByName.get(dep) || 0), 0);
      const depHasDivision = deps.some((dep) => divisionByName.get(dep));
      const depth = expressionDepth(item.initExpr) + depDepth;
      const hasDivision = /[/%]/.test(item.initExpr) || depHasDivision;
      const isAccumulator = accumulators.has(item.name);
      const isSafe = !isAccumulator && depth <= 3 && !hasDivision && deps.length <= 5;

      depthByName.set(item.name, depth);
      divisionByName.set(item.name, hasDivision);

      const before = sourceCode.slice(0, sourceCode.indexOf(item.name, item.index));
      const lines = before.split('\n');

      return {
        name: item.name,
        type: 'float',
        depth,
        hasDivision,
        dependencyCount: deps.length,
        isSafe,
        isAccumulator,
        deps,
        line: lines.length,
        col: lines[lines.length - 1].length + 1,
      };
    });

    const edges = nodes.flatMap((node) => node.deps.map((dep) => ({ from: node.name, to: dep })));
    const safeCount = nodes.filter((node) => node.isSafe).length;
    return {
      name: fn.name,
      totalFloatVars: nodes.length,
      safeToDemote: safeCount,
      safeTodemote: safeCount,
      nodes,
      edges,
    };
  }).filter((fn) => fn.nodes.length > 0);

  let rewritten = sourceCode;
  for (const fn of functions) {
    for (const node of fn.nodes) {
      if (!node.isSafe) continue;
      rewritten = rewritten.replace(new RegExp(`\\bfloat\\s+(${node.name})\\b`, 'g'), '__fp16 $1');
    }
  }

  return {
    functions,
    originalSource: sourceCode,
    rewrittenSource: rewritten,
    dryRun: false,
    mock: true,
  };
}

function normalizeAnalysis(analysis) {
  for (const fn of analysis.functions || []) {
    const safe = fn.safeToDemote ?? fn.safeTodemote ?? 0;
    fn.safeToDemote = safe;
    fn.safeTodemote = safe;
  }
  return analysis;
}

function computeMetrics(analysis) {
  const allNodes = (analysis.functions || []).flatMap((f) => f.nodes || []);
  const total = allNodes.length;
  const safe = allNodes.filter((n) => n.isSafe).length;
  const unsafe = total - safe;

  return {
    totalFloatVars: total,
    safeCount: safe,
    unsafeCount: unsafe,
    accumulatorCount: allNodes.filter((n) => n.isAccumulator).length,
    divisionBlockedCount: allNodes.filter((n) => n.hasDivision && !n.isSafe).length,
    depthBlockedCount: allNodes.filter((n) => n.depth > 3 && !n.isSafe).length,
    demotionRate: total > 0 ? +((safe / total) * 100).toFixed(1) : 0,
    estimatedMaxRelError: safe > 0 ? 0.001 : 0,
    memorySavedPercent: total > 0 ? Math.round((safe / total) * 50) : 0,
    fp16BitWidth: 16,
    fp32BitWidth: 32,
    functionsAnalyzed: analysis.functions?.length || 0,
  };
}

async function analyzeSource(code, filename, tmpFile) {
  const outputJson = path.join(OUTPUT_DIR, `${uuidv4()}.json`);
  try {
    let analysis = null;
    if (isToolAvailable()) {
      analysis = runClangTool(tmpFile, outputJson);
    }
    if (!analysis) {
      analysis = fallbackAnalysis(code, filename);
    }
    analysis = normalizeAnalysis(analysis);
    analysis.metrics = computeMetrics(analysis);
    return analysis;
  } finally {
    fs.remove(outputJson).catch(() => {});
  }
}

app.get('/api/health', (req, res) => {
  const toolReady = isToolAvailable();
  res.json({
    status: 'ok',
    toolReady,
    mode: toolReady ? 'clang-ast' : 'fallback',
    toolPath: toolReady ? TOOL_WSL_PATH : null,
  });
});

app.post('/api/analyze', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  try {
    const code = await fs.readFile(req.file.path, 'utf8');
    const analysis = await analyzeSource(code, req.file.originalname, req.file.path);
    res.json({ jobId: uuidv4(), analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.remove(req.file.path).catch(() => {});
  }
});

app.post('/api/analyze-text', async (req, res) => {
  const { code, filename = 'input.cpp' } = req.body;
  if (!code) return res.status(400).json({ error: 'No code provided' });

  const tmpFile = path.join(UPLOAD_DIR, `${uuidv4()}-${path.basename(filename) || 'input.cpp'}`);
  try {
    await fs.writeFile(tmpFile, code, 'utf8');
    const analysis = await analyzeSource(code, filename, tmpFile);
    res.json({ jobId: uuidv4(), analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.remove(tmpFile).catch(() => {});
  }
});

app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

const toolReady = isToolAvailable();
const server = app.listen(PORT, () => {
  console.log('\nPrecision-Demote Backend');
  console.log(`http://localhost:${PORT}`);
  console.log(`Mode: ${toolReady ? 'REAL Clang AST' : 'Fallback analyzer'}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Start with a different port, for example:`);
    console.error(`  $env:PORT=4100; node server.js`);
    process.exit(1);
  }
  throw err;
});
