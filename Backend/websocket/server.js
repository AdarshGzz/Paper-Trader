const WebSocket = require('ws');
const { setBroadcaster } = require('../app');
const { getStats, getRecentTrades } = require('../services/trade.service');
const { getCandles } = require('../services/candle.service');
const { sql } = require('../utils/db');
const { logInfo, logError } = require('../utils/logger');
const { PORT } = require('../utils/config');

const wss = new WebSocket.Server({ port: PORT });

function broadcast(data) {
  const message = JSON.stringify(data);

  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// When a new client connects, send them the current state immediately
wss.on('connection', async (ws) => {
  logInfo('New frontend client connected');

  try {
    // Get candles from memory first, fall back to DB
    let candles = getCandles();

    if (candles.length === 0) {
      // Load from DB if memory is empty (server just started)
      const dbCandles = await sql`
        SELECT time, open, high, low, close 
        FROM candles 
        ORDER BY time DESC 
        LIMIT 100
      `;
      candles = dbCandles.reverse();
    }

    const stats = await getStats();
    const recentTrades = await getRecentTrades();

    const snapshot = JSON.stringify({
      type: 'snapshot',
      stats: stats || { balance: '1000.00', totalTrades: 0, wins: 0, losses: 0, winRate: '0.00' },
      candles,
      recentTrades
    });

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(snapshot);
    }
  } catch (err) {
    logError('Error sending initial snapshot to client', err);
  }
});

// Inject broadcaster into app
setBroadcaster(broadcast);

logInfo(`WebSocket server running on ws://localhost:${PORT}`);