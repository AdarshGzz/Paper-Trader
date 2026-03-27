const store = require('../store/store');
const { MAX_CANDLES } = require('../utils/config');
const { sql } = require('../utils/db');
const { logInfo, logError } = require('../utils/logger');

// Load historical candles from DB into memory on startup
async function loadCandlesFromDb() {
  try {
    const dbCandles = await sql`
      SELECT time, open, high, low, close 
      FROM candles 
      ORDER BY time DESC 
      LIMIT ${MAX_CANDLES}
    `;
    // Reverse so oldest is first (chronological order)
    store.candles = dbCandles.reverse().map(c => ({
      time: Number(c.time),
      open: parseFloat(c.open),
      high: parseFloat(c.high),
      low: parseFloat(c.low),
      close: parseFloat(c.close)
    }));
    logInfo(`Loaded ${store.candles.length} candles from DB into memory`);
  } catch (err) {
    logError('Error loading candles from DB', err);
  }
}

async function addCandle(candle) {
  store.candles.push(candle);

  // When buffer hits limit, drop 20 oldest candles at once
  if (store.candles.length > MAX_CANDLES) {
    store.candles.splice(0, 20);
  }

  // Persist to DB
  try {
    await sql`
      INSERT INTO candles (time, open, high, low, close)
      VALUES (${candle.time}, ${candle.open}, ${candle.high}, ${candle.low}, ${candle.close})
      ON CONFLICT (time) DO UPDATE SET
        open = EXCLUDED.open,
        high = EXCLUDED.high,
        low = EXCLUDED.low,
        close = EXCLUDED.close
    `;
  } catch (err) {
    logError('Error saving candle to DB', err);
  }
}

function getCandles() {
  return store.candles;
}

function getLastCandle() {
  return store.candles.at(-1);
}

function getPrevCandle() {
  return store.candles.at(-2);
}

module.exports = {
  addCandle,
  getCandles,
  getLastCandle,
  getPrevCandle,
  loadCandlesFromDb
};