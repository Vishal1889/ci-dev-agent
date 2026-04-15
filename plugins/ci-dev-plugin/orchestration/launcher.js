const http = require('http');
const { spawn, exec } = require('child_process');
const path = require('path');
const { isEnabled, PORT } = require('./config');

// Exit immediately if dashboard is disabled
if (!isEnabled()) {
  process.exit(0);
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
 * Open URL in the default browser, platform-independently.
 */
function openBrowser(url) {
  switch (process.platform) {
    case 'win32':
      exec(`start "" "${url}"`);
      break;
    case 'darwin':
      exec(`open "${url}"`);
      break;
    default:
      exec(`xdg-open "${url}"`);
      break;
  }
}

/**
 * Main launcher flow.
 */
async function main() {
  const alreadyRunning = await checkHealth();

  if (!alreadyRunning) {
    startServer();
    const ready = await waitForServer();
    if (!ready) {
      // Server didn't start in time — exit without error
      process.exit(0);
    }
  }

  openBrowser(`http://localhost:${PORT}`);
  process.exit(0);
}

main();
