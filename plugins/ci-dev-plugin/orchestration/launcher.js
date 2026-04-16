const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const { spawn, exec } = require('child_process');
const path = require('path');
const { isEnabled, PORT } = require('./config');

const SESSION_FILE = path.join(__dirname, '.active-session');
const STALE_MS = 2 * 60 * 60 * 1000; // 2 hours

// Exit immediately if dashboard is disabled
if (!isEnabled()) {
  process.exit(0);
}

/**
 * Parse CLI arguments for --session-id and --skill-name flags.
 */
function parseLauncherArgs() {
  const args = process.argv.slice(2);
  let sessionId = null;
  let skillName = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--session-id' && i + 1 < args.length) {
      sessionId = args[i + 1];
      i++;
    } else if (args[i] === '--skill-name' && i + 1 < args.length) {
      skillName = args[i + 1];
      i++;
    }
  }

  return { sessionId, skillName };
}

/**
 * Generate a short random session ID: skill-{8 hex chars}
 */
function generateSessionId() {
  return 'skill-' + crypto.randomBytes(4).toString('hex');
}

/**
 * Check if the server is already running by hitting /health.
 * Returns a promise that resolves to true if healthy, false otherwise.
 */
function checkHealth() {
  return new Promise((resolve) => {
    const req = http.get(`http://localhost:${PORT}/health`, { timeout: 2000 }, (res) => {
      resolve(res.statusCode === 200);
      res.resume(); // consume response data
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

/**
 * Start the server as a detached background process.
 */
function startServer() {
  const serverPath = path.join(__dirname, 'server.js');
  const child = spawn('node', [serverPath], {
    detached: true,
    stdio: 'ignore',
    cwd: __dirname,
  });
  child.unref();
}

/**
 * Poll /health until the server is ready. Max 10 attempts, 500ms apart.
 */
async function waitForServer() {
  for (let i = 0; i < 10; i++) {
    if (await checkHealth()) return true;
    await new Promise(r => setTimeout(r, 500));
  }
  return false;
}

/**
 * Append session entry to .active-session (multi-entry array).
 * Filters stale entries and writes back atomically.
 */
function writeActiveSession(sessionId, skillName) {
  try {
    let entries = [];
    try {
      const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
      entries = JSON.parse(raw);
      if (!Array.isArray(entries)) entries = [];
    } catch {
      // File doesn't exist or is malformed — start fresh
    }

    // Filter stale entries (>2 hours old)
    const now = Date.now();
    entries = entries.filter(e => e.timestamp && (now - e.timestamp) < STALE_MS);

    // Append new entry
    entries.push({ sessionId, skillName: skillName || 'unknown', timestamp: now });

    fs.writeFileSync(SESSION_FILE, JSON.stringify(entries, null, 2));
  } catch {
    // Never block the skill on file write failures
  }
}

/**
 * Open URL in the default browser, platform-independently.
 * Returns a promise that resolves when the command completes (or after a timeout).
 */
function openBrowser(url) {
  return new Promise((resolve) => {
    let cmd;
    switch (process.platform) {
      case 'win32':
        // Use cmd.exe explicitly — exec inside Git Bash may not find 'start'
        cmd = `cmd.exe /c start "" "${url}"`;
        break;
      case 'darwin':
        cmd = `open "${url}"`;
        break;
      default:
        cmd = `xdg-open "${url}"`;
        break;
    }
    exec(cmd, (err) => {
      // Resolve regardless — don't block the hook on browser open failure
      resolve();
    });
    // Safety timeout: don't wait longer than 3s for browser to open
    setTimeout(resolve, 3000);
  });
}

/**
 * Main launcher flow.
 */
async function main() {
  const { sessionId: providedSessionId, skillName } = parseLauncherArgs();
  const sessionId = providedSessionId || generateSessionId();

  const alreadyRunning = await checkHealth();

  if (!alreadyRunning) {
    startServer();
    const ready = await waitForServer();
    if (!ready) {
      // Server didn't start in time — exit without error
      process.exit(0);
    }
  }

  await openBrowser(`http://localhost:${PORT}`);

  // Persist session for hooks to read
  writeActiveSession(sessionId, skillName);

  // Output session ID for the skill to capture
  console.log(`session:${sessionId}`);

  process.exit(0);
}

main();
