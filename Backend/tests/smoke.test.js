const { sql, initDb } = require('../utils/db');
const { createTrade, getStats } = require('../services/trade.service');
const { addCandle } = require('../services/candle.service');
const { logInfo, logError } = require('../utils/logger');

async function runTest() {
  try {
    logInfo('Starting Smoke Test...');

    // 1. Initialize DB
    await initDb();
    logInfo('DB initialized');

    // 2. Add a dummy candle
    const dummyCandle = {
      time: Date.now(),
      open: 50000,
      high: 51000,
      low: 49000,
      close: 50500
    };
    await addCandle(dummyCandle);
    logInfo('Dummy candle added');

    // 3. Create a trade
    const trade = await createTrade('BUY');
    logInfo('Trade created', trade);

    // 4. Get stats
    const stats = await getStats();
    logInfo('Stats fetched', stats);

    logInfo('Smoke Test Completed Successfully!');
    process.exit(0);
  } catch (err) {
    logError('Smoke Test Failed', err);
    process.exit(1);
  }
}

runTest();
