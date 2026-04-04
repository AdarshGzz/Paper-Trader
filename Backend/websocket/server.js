const WebSocket = require('ws');
const http = require('http');
const { setBroadcaster } = require('../app');
const { getStats, getRecentTrades, getTradesPaged } = require('../services/trade.service');
const { getCandles } = require('../services/candle.service');
const { sql } = require('../utils/db');
const { logInfo, logError } = require('../utils/logger');
const { PORT } = require('../utils/config');

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Attach WebSocket server to the HTTP server
const wss = new WebSocket.Server({ server });

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
    const pagedResults = await getTradesPaged(1, 10);

    const snapshot = JSON.stringify({
      type: 'snapshot',
      stats: stats || { 
        balance: '1000.00', 
        initialCapital: '1000.00', 
        totalTrades: 0, 
        wins: 0, 
        losses: 0, 
        winRate: '0.00' 
      },
      candles,
      recentTrades,
      history: {
        trades: pagedResults.trades,
        totalCount: pagedResults.totalCount,
        page: pagedResults.page,
        totalPages: pagedResults.totalPages
      }
    });

    if (ws.readyState === WebSocket.OPEN) {
      ws.send(snapshot);
    }

    // Handle messages from client
    ws.on('message', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        logInfo('WS Message received from client', { type: message.type });
        if (message.type === 'request_trades_page') {
          const { page = 1, limit = 10 } = message;
          const { getTradesPaged } = require('../services/trade.service');
          const pagedResults = await getTradesPaged(page, limit);
          
          logInfo(`Sending trades_page. ws.readyState: ${ws.readyState}`, { totalCount: pagedResults.totalCount });

          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: 'trades_page',
              trades: pagedResults.trades,
              totalCount: pagedResults.totalCount,
              page: pagedResults.page,
              totalPages: pagedResults.totalPages
            }));
            logInfo('Sent trades_page successfully');
          } else {
            logError('Cannot send trades_page, ws not open', { state: ws.readyState });
          }
        }
      } catch (err) {
        logError('Error processing client message', err);
      }
    });
  } catch (err) {
    logError('Error sending initial snapshot to client', err);
  }
});

// Inject broadcaster into app
setBroadcaster(broadcast);

function startWsServer() {
  server.listen(PORT, () => {
    logInfo(`Server (HTTP + WS) running on port ${PORT}`);
  });
}

module.exports = {
  startWsServer
};