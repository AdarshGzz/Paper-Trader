const { generateSignal } = require('./services/strategy.service');
const { createTrade, evaluateTrades, getStats } = require('./services/trade.service');
const { getCandles } = require('./services/candle.service');
const { logInfo, logError } = require('./utils/logger');

let broadcaster = null;

// Inject WebSocket broadcast function
function setBroadcaster(fn) {
  broadcaster = fn;
}

// Main function called on every candle close
async function onCandleClose(candle) {
  try {
    logInfo('Candle closed', { time: candle.time, close: candle.close });

    const candles = getCandles();

    // Step 1: Evaluate previous trades
    await evaluateTrades();

    // Step 2: Generate new signal
    const signal = generateSignal();

    if (signal) {
      logInfo('Signal generated', { signal });
      await createTrade(signal);
    }

    // Step 3: Send data to frontend
    if (broadcaster) {
      const stats = await getStats();
      const recentTrades = await require('./services/trade.service').getRecentTrades();
      broadcaster({
        stats,
        candles,
        recentTrades
      });
    }
  } catch (err) {
    logError('Error in onCandleClose loop', err);
  }
}

module.exports = {
  onCandleClose,
  setBroadcaster
};