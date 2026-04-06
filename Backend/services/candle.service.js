const store = require('../store/store');
const { MAX_CANDLES } = require('../utils/config');
const { sql } = require('../utils/db');
const { logInfo, logError } = require('../utils/logger');
const ccxt = require('ccxt');

// Single binance instance with timeout to prevent hangs
const binance = new ccxt.binance({
  timeout: 20000, // 20s timeout
  enableRateLimit: true
});

// Sync missing candles from Binance REST API in background
async function syncMissingCandles() {
  try {
    logInfo('Starting background data sync for historical candles...');
    
    // Fetch last 500 klines (OHLCV) for 5m interval (covers ~41 hours)
    // Wrap in retry to handle temporary network blips
    let ohlcv = [];
    let retries = 3;
    while (retries > 0) {
      try {
        ohlcv = await binance.fetchOHLCV('BTC/USDT', '5m', undefined, 500);
        break;
      } catch (err) {
        retries--;
        logError(`Failed to fetch history from Binance (${retries} retries left)`, err.message);
        if (retries === 0) throw err;
        await new Promise(r => setTimeout(r, 2000));
      }
    }
    
    let syncedCount = 0;
    for (const [time, open, high, low, close] of ohlcv) {
      const candle = {
        time: Number(time),
        open: parseFloat(open),
        high: parseFloat(high),
        low: parseFloat(low),
        close: parseFloat(close)
      };
      
      await addCandle(candle);
      syncedCount++;
      
      if (syncedCount % 50 === 0) {
        logInfo(`Sync progress: ${syncedCount}/${ohlcv.length} candles...`);
      }
    }
    
    logInfo(`Successfully synced ${syncedCount} candles from Binance REST API.`);
  } catch (err) {
    logError('Critical error during background candle sync', err.message);
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

  // When buffer hits limit, keep recent ones
  if (store.candles.length > MAX_CANDLES) {
    store.candles = store.candles.slice(-MAX_CANDLES);
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
    logError('Error saving candle to DB', err.message);
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