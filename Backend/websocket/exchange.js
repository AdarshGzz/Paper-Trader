const WebSocket = require('ws');
const { addCandle } = require('../services/candle.service');
const { createCandleModel } = require('../models/candle.model');
const { logInfo, logError } = require('../utils/logger');
const { onCandleClose, onTick } = require('../app');
const { BINANCE_WS_URL } = require('../utils/config');

let ws;

function connect() {
  logInfo(`Connecting to Binance WebSocket: ${BINANCE_WS_URL}`);
  ws = new WebSocket(BINANCE_WS_URL);

  ws.on('open', () => {
    logInfo('Connected to Binance WebSocket');
  });

  ws.on('message', async (data) => {
    try {
      const msg = JSON.parse(data);
      const stream = (msg.stream || '').toLowerCase();
      const payload = msg.data;

      // Handle Kline Stream (5m)
      if (stream === 'btcusdt@kline_5m') {
        const kline = payload.k;
        const candle = createCandleModel({
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          time: kline.t
        });

        // Only act on logic when candle closes
        if (kline.x) {
          await addCandle(candle);
          await onCandleClose(candle);
        }
      }

      // Handle AggTrade Stream (Zero Lag Millisecond Updates)
      if (stream === 'btcusdt@aggtrade') {
        onTick({
          close: parseFloat(payload.p),
          time: Math.floor(payload.T / (5 * 60 * 1000)) * (5 * 60 * 1000),
          isTrade: true
        });
      }

    } catch (err) {
      logError('Error parsing WS message', err);
    }
  });

  ws.on('close', () => {
    logError('WebSocket closed. Reconnecting...');
    setTimeout(connect, 5000);
  });

  ws.on('error', (err) => {
    logError('WebSocket error', err);
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });
}

module.exports = {
  connect
};