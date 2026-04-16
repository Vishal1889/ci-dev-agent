const http = require('http');
const fs = require('fs');
const path = require('path');
const { isEnabled, PORT } = require('./config');

const SESSION_FILE = path.join(__dirname, '.active-session');
const STALE_MS = 2 * 60 * 60 * 1000; // 2 hours

// Exit immediately if dashboard is disabled
if (!isEnabled()) {
  process.exit(0);
}

const eventType = process.argv[2] || 'unknown';

/**
 * Parse CLI arguments for --json, --session, and --cleanup flags.
 * Returns { json: string|null, session: string|null, cleanup: boolean }
 */
function parseCLIArgs() {
  const args = process.argv.slice(3);
  let json = null;
  let session = null;
  let cleanup = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json' && i + 1 < args.length) {
      json = args[i + 1];
      i++;
    } else if (args[i] === '--session' && i + 1 < args.length) {
      session = args[i + 1];
      i++;
    } else if (args[i] === '--cleanup') {
      cleanup = true;
    }
  }

  return { json, session, cleanup };
}

/**
 * Read all active sessions from .active-session file.
 * Filters stale entries (>2 hours old).
 * Returns array of { sessionId, skillName } or empty array.
 */
function readActiveSessions() {
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    let entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return [];

    const now = Date.now();
    return entries
      .filter(e => e.sessionId && e.timestamp && (now - e.timestamp) < STALE_MS)
      .map(e => ({ sessionId: e.sessionId, skillName: e.skillName || 'unknown' }));
  } catch {
    return [];
  }
}

/**
 * Remove a session entry from .active-session by sessionId.
 */
function removeSessionEntry(sessionId) {
  try {
    const raw = fs.readFileSync(SESSION_FILE, 'utf-8');
    let entries = JSON.parse(raw);
    if (!Array.isArray(entries)) return;

    entries = entries.filter(e => e.sessionId !== sessionId);

    if (entries.length === 0) {
      fs.unlinkSync(SESSION_FILE);
    } else {
      fs.writeFileSync(SESSION_FILE, JSON.stringify(entries, null, 2));
    }
  } catch {
    // Silent — cleanup is best-effort
  }
}

/**
 * Send the event payload to the dashboard server.
 * When pendingCount reaches 0, perform cleanup if needed and exit.
 */
let pendingRequests = 0;
let cleanupSessionId = null;

function onRequestDone() {
  pendingRequests--;
  if (pendingRequests <= 0) {
    if (cleanupSessionId) {
      removeSessionEntry(cleanupSessionId);
    }
    process.exit(0);
  }
}

function sendEvent(data, sessionId, skillName) {
  if (sessionId) {
    data.session_id = sessionId;
  }
  if (skillName) {
    data.skill_name = skillName;
  }

  const payload = JSON.stringify({
    type: eventType,
    data: data,
    timestamp: Date.now(),
  });

  const req = http.request({
    hostname: 'localhost',
    port: PORT,
    path: '/events',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    timeout: 2000,
  }, () => {
    onRequestDone();
  });

  req.on('error', () => {
    onRequestDone();
  });

  req.on('timeout', () => {
    req.destroy();
    onRequestDone();
  });

  req.write(payload);
  req.end();
}

/**
 * Send event to one or more sessions.
 * If explicit session is provided, send to just that session.
 * Otherwise, send to all active sessions from .active-session file.
 */
function dispatchEvent(data, explicitSession, cleanup) {
  if (explicitSession) {
    // Explicit session mode (skill sends phase events with --session)
    pendingRequests = 1;
    if (cleanup) cleanupSessionId = explicitSession;
    sendEvent({ ...data }, explicitSession, null);
  } else {
    // Hook mode — send to all active sessions
    const activeSessions = readActiveSessions();
    if (activeSessions.length === 0) {
      // No active sessions — send to 'unknown' as fallback
      pendingRequests = 1;
      sendEvent({ ...data }, null, null);
    } else {
      pendingRequests = activeSessions.length;
      for (const { sessionId, skillName } of activeSessions) {
        sendEvent({ ...data }, sessionId, skillName);
      }
    }
  }
}

const { json: jsonArg, session: sessionArg, cleanup: cleanupFlag } = parseCLIArgs();

if (jsonArg !== null) {
  // Platform-independent mode: data passed via --json CLI argument
  let data = {};
  try {
    data = JSON.parse(jsonArg);
  } catch {
    // Invalid JSON — send empty data
  }
  dispatchEvent(data, sessionArg, cleanupFlag);
} else {
  // Hook mode: data piped via stdin (backwards-compatible)
  let input = '';
  process.stdin.setEncoding('utf-8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    let data = {};
    try {
      data = JSON.parse(input);
    } catch {
      // stdin may be empty for some hook events — that's okay
    }
    dispatchEvent(data, sessionArg, cleanupFlag);
  });

  // If stdin closes immediately (no data), still send the event
  setTimeout(() => {
    if (!input) {
      process.stdin.emit('end');
    }
  }, 500);
}
