const http = require('http');
const { isEnabled, PORT } = require('./config');

// Exit immediately if dashboard is disabled
if (!isEnabled()) {
  process.exit(0);
}

// Read event data from stdin (hook input)
let input = '';
process.stdin.setEncoding('utf-8');
process.stdin.on('data', (chunk) => { input += chunk; });
process.stdin.on('end', () => {
  const eventType = process.argv[2] || 'unknown';

  let data = {};
  try {
    data = JSON.parse(input);
  } catch {
    // stdin may be empty for some hook events — that's okay
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
    process.exit(0);
  });

  req.on('error', () => {
    // Server not running — exit silently, don't block the skill
    process.exit(0);
  });

  req.on('timeout', () => {
    req.destroy();
    process.exit(0);
  });

  req.write(payload);
  req.end();
});

// If stdin closes immediately (no data), still send the event
setTimeout(() => {
  if (!input) {
    process.stdin.emit('end');
  }
}, 500);
