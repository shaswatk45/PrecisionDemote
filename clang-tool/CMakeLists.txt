cmake_minimum_required(VERSION 3.16)
project(PrecisionDemotionTool LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_EXPORT_COMPILE_COMMANDS ON)

# ── Find LLVM ──────────────────────────────────────────────────────────────────
find_package(LLVM REQUIRED CONFIG)
message(STATUS "Found LLVM ${LLVM_PACKAGE_VERSION}")
message(STATUS "Using LLVMConfig.cmake in: ${LLVM_DIR}")

list(APPEND CMAKE_MODULE_PATH "${LLVM_CMAKE_DIR}")
include(AddLLVM)

# ── Find Clang ─────────────────────────────────────────────────────────────────
find_package(Clang REQUIRED CONFIG)
message(STATUS "Found Clang in: ${CLANG_CMAKE_DIR}")

# ── Include / definitions ─────────────────────────────────────────────────────
include_directories(SYSTEM ${LLVM_INCLUDE_DIRS} ${CLANG_INCLUDE_DIRS})
separate_arguments(LLVM_DEFINITIONS_LIST NATIVE_COMMAND ${LLVM_DEFINITIONS})
add_definitions(${LLVM_DEFINITIONS_LIST})

# Silence RTTI mismatch — LLVM is built without RTTI on most distros
if(NOT LLVM_ENABLE_RTTI)
    set(CMAKE_CXX_FLAGS "${CMAKE_CXX_FLAGS} -fno-rtti")
endif()

# ── Use LLVM's shared library (libLLVM-18.so) to avoid duplicate symbols ─────
# This is the correct approach for out-of-tree tools on Ubuntu/Debian packages.
set(USE_SHARED_LLVM ON)

# ── The tool executable ───────────────────────────────────────────────────────
add_executable(precision-demote
    src/main.cpp
)

# Link against the single shared LLVM lib + individual Clang component libs
target_link_libraries(precision-demote PRIVATE
    LLVM
    clangTooling
    clangBasic
    clangASTMatchers
    clangAST
    clangFrontend
    clangSerialization
    clangDriver
    clangParse
    clangSema
    clangAnalysis
    clangEdit
    clangLex
    clangRewrite
    clangRewriteFrontend
)

install(TARGETS precision-demote RUNTIME DESTINATION bin)
