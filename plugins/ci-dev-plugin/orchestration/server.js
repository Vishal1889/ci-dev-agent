const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');

const { PORT } = require('./config');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// In-memory event storage: Map<sessionId, Event[]>
const sessions = new Map();

// Idle auto-shutdown: 30 minutes with no events
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
let idleTimer = null;

function resetIdleTimer() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    console.log('No events for 30 minutes — shutting down.');
    process.exit(0);
  }, IDLE_TIMEOUT_MS);
}

resetIdleTimer();

// Parse JSON bodies
app.use(express.json());

// Serve static dashboard files
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// List active sessions
app.get('/api/sessions', (_req, res) => {
  const result = [];
  for (const [sessionId, events] of sessions) {
    const lastEvent = events[events.length - 1];
    result.push({
      sessionId,
      eventCount: events.length,
      lastEventAt: lastEvent ? lastEvent.timestamp : null,
      firstEventAt: events[0] ? events[0].timestamp : null,
    });
  }
  // Sort by most recent activity
  result.sort((a, b) => (b.lastEventAt || 0) - (a.lastEventAt || 0));
  res.json(result);
});

// Get events for a specific session
app.get('/api/sessions/:sessionId/events', (req, res) => {
  const events = sessions.get(req.params.sessionId) || [];
  res.json(events);
});

// Receive events from hooks
app.post('/events', (req, res) => {
  const event = req.body;
  const sessionId = event.data?.session_id || 'unknown';
  const timestamp = event.timestamp || Date.now();

  const enrichedEvent = { ...event, sessionId, timestamp };

  // Store by session
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  sessions.get(sessionId).push(enrichedEvent);

  // Broadcast to all WebSocket clients
  const message = JSON.stringify(enrichedEvent);
  for (const client of wss.clients) {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(message);
    }
  }

  resetIdleTimer();
  res.json({ received: true });
});

// WebSocket connection — send existing sessions list on connect
wss.on('connection', (ws) => {
  const sessionList = [];
  for (const [sessionId, events] of sessions) {
    sessionList.push({
      sessionId,
      eventCount: events.length,
      lastEventAt: events[events.length - 1]?.timestamp || null,
    });
  }
  ws.send(JSON.stringify({ type: 'init', sessions: sessionList }));
});

server.listen(PORT, () => {
  console.log(`Orchestration dashboard running at http://localhost:${PORT}`);
});
