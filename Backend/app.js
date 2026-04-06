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
      
      // Immediate broadcast of new trade state
      if (broadcaster) {
        const stats = await getStats();
        const recentTrades = await require('./services/trade.service').getRecentTrades();
        broadcaster({
          type: 'snapshot',
          stats,
          candles,
          recentTrades
        });
      }
    }

    // Step 3: Send data to frontend
    if (broadcaster) {
      const stats = await getStats();
      const recentTrades = await require('./services/trade.service').getRecentTrades();
      broadcaster({
        type: 'snapshot',
        stats,
        candles,
        recentTrades
      });
    }
  } catch (err) {
    logError('Error in onCandleClose loop', err);
  }
}

let lastEvalTime = 0;

// Support real-time price "ticks" between candle closes
async function onTick(candle) {
  if (broadcaster) {
    broadcaster({
      type: 'tick',
      candle
    });
  }

  // Throttle realtime trade evaluation to once per second
  const now = Date.now();
  if (now - lastEvalTime < 1000) return;
  lastEvalTime = now;

  // Real-time trade evaluation
  try {
    await evaluateTradesRealtime(candle.close);
  } catch (err) {
    logError('Error in realtime trade evaluation', err);
  }
}

// Evaluate trades against live tick price for instant SL/TP detection
async function evaluateTradesRealtime(currentPrice) {
  const { sql } = require('./utils/db');
  const openTrades = await sql`SELECT * FROM trades WHERE result IS NULL`;
  
  if (openTrades.length === 0) return;

  for (const trade of openTrades) {
    let result = null;
    let exitPrice = null;

    if (trade.type === "BUY") {
      if (currentPrice <= trade.sl) {
        result = "LOSS";
        exitPrice = trade.sl;
      } else if (currentPrice >= trade.tp) {
        result = "WIN";
        exitPrice = trade.tp;
      }
    } else {
      // SELL
      if (currentPrice >= trade.sl) {
        result = "LOSS";
        exitPrice = trade.sl;
      } else if (currentPrice <= trade.tp) {
        result = "WIN";
        exitPrice = trade.tp;
      }
    }

    if (result) {
      const profitChange = (trade.type === "BUY")
        ? (exitPrice - trade.entry) * trade.quantity
        : (trade.entry - exitPrice) * trade.quantity;

      const updatedBalanceResult = await sql`
        UPDATE app_state SET value = value + ${profitChange} WHERE key = 'balance' RETURNING value
      `;
      await sql`
        UPDATE app_state SET value = value + ${profitChange} WHERE key = 'daily_pnl'
      `;
      const finalBalance = updatedBalanceResult[0]?.value;
      
      await sql`
        UPDATE trades 
        SET exit = ${exitPrice}, result = ${result}, balance_after = ${finalBalance}, closed_at = NOW()
        WHERE id = ${trade.id}
      `;

      logInfo(`Trade ${trade.id} closed via REALTIME tick: ${result}`, { exitPrice, profitChange, finalBalance });

      // Immediately broadcast updated state to frontend
      if (broadcaster) {
        const { getStats, getRecentTrades } = require('./services/trade.service');
        const { getCandles } = require('./services/candle.service');
        const stats = await getStats();
        const recentTrades = await getRecentTrades();
        broadcaster({
          type: 'snapshot',
          stats,
          candles: getCandles(),
          recentTrades
        });
      }
    }
  }
}

module.exports = {
  onCandleClose,
  onTick,
  setBroadcaster
};