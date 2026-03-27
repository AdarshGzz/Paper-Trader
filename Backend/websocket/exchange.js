const WebSocket = require('ws');
const { addCandle } = require('../services/candle.service');
const { createCandleModel } = require('../models/candle.model');
const { logInfo, logError } = require('../utils/logger');
const { onCandleClose } = require('../app');
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
      const json = JSON.parse(data);
      if (!json.k) return;
      
      const kline = json.k;

      const candle = createCandleModel({
        open: parseFloat(kline.o),
        high: parseFloat(kline.h),
        low: parseFloat(kline.l),
        close: parseFloat(kline.c),
        time: kline.t
      });

      // Only act when candle closes
      if (kline.x) {
        await addCandle(candle);
        await onCandleClose(candle);
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