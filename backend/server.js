'use strict';

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { execFileSync } = require('child_process');

const {
  fallbackAnalysis,
  normalizeAnalysis,
  computeMetrics,
  toSarif,
  EXAMPLES,
  DEFAULT_THRESHOLDS,
} = require('./analyzer');

const pkg = require('./package.json');

const app = express();
const PORT = process.env.PORT || 4000;
const WSL_DISTRO = process.env.WSL_DISTRO || 'Ubuntu';
const TOOL_WIN_PATH = path.resolve(__dirname, '../clang-tool/build/precision-demote');
const TOOL_WSL_PATH = process.env.TOOL_WSL_PATH || toWSLPath(TOOL_WIN_PATH);
const UPLOAD_DIR = path.resolve(__dirname, 'uploads');
const OUTPUT_DIR = path.resolve(__dirname, 'outputs');

// Thresholds are configurable via env so the analysis contract is not hard-coded.
const THRESHOLDS = {
  maxDepth: intEnv('MAX_DEPTH', DEFAULT_THRESHOLDS.maxDepth),
  maxFanIn: intEnv('MAX_FAN_IN', DEFAULT_THRESHOLDS.maxFanIn),
};

fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(OUTPUT_DIR);

function intEnv(name, fallback) {
  const v = parseInt(process.env[name], 10);
  return Number.isFinite(v) && v >= 0 ? v : fallback;
}

// ── Middleware ────────────────────────────────────────────────────────────

// Minimal security headers (dependency-free — avoids pulling in helmet).
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-XSS-Protection', '0');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
  next();
});

// CORS: restrict to configured origins in production, permissive in dev.
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors(ALLOWED_ORIGINS.length ? { origin: ALLOWED_ORIGINS } : {}));

app.use(express.json({ limit: '2mb' }));

// Simple in-memory sliding-window rate limiter for the analysis endpoints.
// Keeps a well-meaning demo from being turned into a subprocess-spawning DoS.
const RATE_LIMIT = intEnv('RATE_LIMIT', 60); // requests
const RATE_WINDOW_MS = intEnv('RATE_WINDOW_MS', 60_000); // per window
const rateBuckets = new Map();

function rateLimit(req, res, next) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const hits = (rateBuckets.get(key) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (hits.length >= RATE_LIMIT) {
    res.setHeader('Retry-After', Math.ceil(RATE_WINDOW_MS / 1000));
    return res.status(429).json({ error: 'Too many requests, slow down.' });
  }
  hits.push(now);
  rateBuckets.set(key, hits);
  next();
}

// Periodically drop stale buckets so the map does not grow unbounded.
const sweepTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of rateBuckets) {
    const fresh = hits.filter((t) => now - t < RATE_WINDOW_MS);
    if (fresh.length) rateBuckets.set(key, fresh);
    else rateBuckets.delete(key);
  }
}, RATE_WINDOW_MS);
sweepTimer.unref?.();

// ── Upload handling ───────────────────────────────────────────────────────

const storage = multer.diskStorage({
  destination: UPLOAD_DIR,
  // Never trust the client filename on disk — use a UUID and keep only a safe
  // extension. The original name is preserved separately for display.
  filename: (req, file, cb) => {
    const ext = (path.extname(file.originalname) || '.cpp').toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const ok = /\.(c|cpp|cc|cxx|h|hpp)$/i.test(file.originalname);
    cb(ok ? null : new Error('Only C/C++ files are allowed'), ok);
  },
  limits: { fileSize: 2 * 1024 * 1024 },
});

// ── Clang-tool bridge ───────────────────────────────────────────────────────

function toWSLPath(winPath) {
  const resolved = path.resolve(winPath);
  const drive = resolved[0].toLowerCase();
  const rest = resolved.slice(2).replace(/\\/g, '/');
  return `/mnt/${drive}${rest}`;
}

function isToolAvailable() {
  try {
    // Arg-array form: no shell, so paths are passed literally (no injection).
    execFileSync('wsl', ['-d', WSL_DISTRO, '--', 'test', '-x', TOOL_WSL_PATH], {
      stdio: 'pipe',
      timeout: 5000,
    });
    return true;
  } catch {
    return false;
  }
}

function runClangTool(srcPath, outputJsonPath, activeThresholds = THRESHOLDS) {
  const wslSrc = toWSLPath(srcPath);
  const wslOut = toWSLPath(outputJsonPath);

  const args = [
    '-d', WSL_DISTRO, '--',
    TOOL_WSL_PATH, wslSrc,
    '--output-json', wslOut,
    `--max-depth=${activeThresholds.maxDepth}`,
    `--max-fan-in=${activeThresholds.maxFanIn}`,
    '--', '-std=c++17',
  ];

  try {
    const stdout = execFileSync('wsl', args, {
      timeout: 30000,
      stdio: ['pipe', 'pipe', 'pipe'],
      encoding: 'utf8',
    });
    if (stdout && stdout.trim()) console.log('[tool]', stdout.trim());
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

async function analyzeSource(code, filename, tmpFile, userThresholds = null) {
  const outputJson = path.join(OUTPUT_DIR, `${uuidv4()}.json`);
  const activeThresholds = userThresholds
    ? { ...THRESHOLDS, ...userThresholds }
    : THRESHOLDS;
  try {
    let analysis = null;
    if (isToolAvailable()) {
      analysis = runClangTool(tmpFile, outputJson, activeThresholds);
    }
    if (!analysis) {
      analysis = fallbackAnalysis(code, filename, activeThresholds);
    }
    analysis = normalizeAnalysis(analysis);
    analysis.metrics = computeMetrics(analysis);
    analysis.thresholds = activeThresholds;
    return analysis;
  } finally {
    fs.remove(outputJson).catch(() => {});
  }
}


// ── Routes ──────────────────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
  const toolReady = isToolAvailable();
  res.json({
    status: 'ok',
    toolReady,
    mode: toolReady ? 'clang-ast' : 'fallback',
    toolPath: toolReady ? TOOL_WSL_PATH : null,
    thresholds: THRESHOLDS,
  });
});

app.get('/api/version', (req, res) => {
  res.json({
    name: pkg.name,
    version: pkg.version,
    engine: isToolAvailable() ? 'clang-ast' : 'fallback-js',
    node: process.version,
  });
});

app.post('/api/analyze', rateLimit, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  let userThresholds = null;
  if (req.body.thresholds) {
    try {
      userThresholds = typeof req.body.thresholds === 'string'
        ? JSON.parse(req.body.thresholds)
        : req.body.thresholds;
    } catch (e) {
      console.warn('Failed to parse thresholds:', e);
    }
  }

  try {
    const code = await fs.readFile(req.file.path, 'utf8');
    const analysis = await analyzeSource(code, req.file.originalname, req.file.path, userThresholds);
    res.json({ jobId: uuidv4(), analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.remove(req.file.path).catch(() => {});
  }
});

app.post('/api/analyze-text', rateLimit, async (req, res) => {
  const { code, filename = 'input.cpp', thresholds } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'No code provided' });
  }

  let userThresholds = null;
  if (thresholds) {
    try {
      userThresholds = typeof thresholds === 'string'
        ? JSON.parse(thresholds)
        : thresholds;
    } catch (e) {
      console.warn('Failed to parse thresholds:', e);
    }
  }

  const ext = (path.extname(filename) || '.cpp').toLowerCase();
  const tmpFile = path.join(UPLOAD_DIR, `${uuidv4()}${/\.(c|cpp|cc|cxx|h|hpp)$/i.test(ext) ? ext : '.cpp'}`);
  try {
    await fs.writeFile(tmpFile, code, 'utf8');
    const analysis = await analyzeSource(code, path.basename(filename) || 'input.cpp', tmpFile, userThresholds);
    res.json({ jobId: uuidv4(), analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.remove(tmpFile).catch(() => {});
  }
});


// Curated example kernels for the UI gallery.
app.get('/api/examples', (req, res) => {
  res.json({ examples: EXAMPLES });
});

// Analyze code and return a SARIF 2.1.0 log (GitHub code-scanning compatible).
app.post('/api/sarif', rateLimit, async (req, res) => {
  const { code, filename = 'input.cpp' } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'No code provided' });
  }
  const tmpFile = path.join(UPLOAD_DIR, `${uuidv4()}.cpp`);
  try {
    await fs.writeFile(tmpFile, code, 'utf8');
    const analysis = await analyzeSource(code, filename, tmpFile);
    const sarif = toSarif(analysis, path.basename(filename));
    res.setHeader('Content-Type', 'application/sarif+json');
    res.setHeader('Content-Disposition', 'attachment; filename="precision-demote.sarif"');
    res.send(JSON.stringify(sarif, null, 2));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  } finally {
    fs.remove(tmpFile).catch(() => {});
  }
});

// Analyze code and stream back the rewritten source as a downloadable file.
app.post('/api/download', rateLimit, async (req, res) => {
  const { code, filename = 'input.cpp' } = req.body;
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'No code provided' });
  }

  const base = path.basename(filename).replace(/\.(c|cpp|cc|cxx|h|hpp)$/i, '') || 'input';
  const tmpFile = path.join(UPLOAD_DIR, `${uuidv4()}.cpp`);
  try {
    await fs.writeFile(tmpFile, code, 'utf8');
    const analysis = await analyzeSource(code, filename, tmpFile);
    res.setHeader('Content-Type', 'text/x-c++src; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.fp16.cpp"`);
    res.send(analysis.rewrittenSource || code);
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

// ── Boot ──────────────────────────────────────────────────────────────────

// Only start listening when run directly, so the app can be imported by tests.
if (require.main === module) {
  const toolReady = isToolAvailable();
  const server = app.listen(PORT, () => {
    console.log(`\nPrecision-Demote Backend v${pkg.version}`);
    console.log(`http://localhost:${PORT}`);
    console.log(`Mode: ${toolReady ? 'REAL Clang AST' : 'Fallback analyzer'}`);
    console.log(`Thresholds: depth<=${THRESHOLDS.maxDepth}, fan-in<=${THRESHOLDS.maxFanIn}\n`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use. Start with a different port, for example:`);
      console.error(`  $env:PORT=4100; node server.js`);
      process.exit(1);
    }
    throw err;
  });
}

module.exports = { app, analyzeSource, isToolAvailable, THRESHOLDS };
