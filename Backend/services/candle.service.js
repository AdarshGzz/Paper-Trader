const store = require('../store/store');
const { MAX_CANDLES } = require('../utils/config');
const { sql } = require('../utils/db');
const { logInfo, logError } = require('../utils/logger');
const ccxt = require('ccxt');

const binance = new ccxt.binance();

// Sync missing candles from Binance REST API on startup
async function syncMissingCandles() {
  try {
    logInfo('Syncing missing candles from Binance REST API...');
    
    // Fetch last 100 klines (OHLCV) for 5m interval
    const ohlcv = await binance.fetchOHLCV('BTC/USDT', '5m', undefined, 100);
    
    let syncedCount = 0;
    for (const [time, open, high, low, close] of ohlcv) {
      const candle = {
        time: Number(time),
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close)
      };
      
      // Use the generic addCandle which handles duplication and DB persistence
      await addCandle(candle);
      syncedCount++;
    }
    
    logInfo(`Successfully synced ${syncedCount} candles from Binance REST API.`);
  } catch (err) {
    logError('Error syncing candles from Binance REST API', err);
  }
}

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
  // Prevent duplicates in memory
  if (store.candles.some(c => c.time === candle.time)) {
    return;
  }

  store.candles.push(candle);

  // When buffer hits limit, drop 20 oldest candles at once
  if (store.candles.length > Math.max(MAX_CANDLES, 100)) {
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
  loadCandlesFromDb,
  syncMissingCandles
};