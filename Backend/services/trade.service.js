const { sql } = require('../utils/db');
const { getCandles } = require('./candle.service');
const { createTradeModel } = require('../models/trade.model');
const { logInfo, logError, logTrade } = require('../utils/logger');
const { 
  MAX_DAILY_LOSS_LIMIT, 
  MAX_DAILY_PROFIT_TARGET 
} = require('../utils/config');

async function getBalance() {
  const result = await sql`SELECT value FROM app_state WHERE key = 'balance'`;
  return parseFloat(result[0]?.value || 0);
}

async function getDailyState() {
  const pnl = await sql`SELECT value FROM app_state WHERE key = 'daily_pnl'`;
  const lastReset = await sql`SELECT value FROM app_state WHERE key = 'last_pnl_reset'`;
  return { 
    dailyPnl: parseFloat(pnl[0]?.value || 0), 
    lastReset: Number(lastReset[0]?.value || 0) 
  };
}

async function resetDailyPnlIfNeeded() {
  const { lastReset } = await getDailyState();
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const currentIstDate = new Date(now.getTime() + istOffset).getUTCDate();
  const lastIstDate = new Date(lastReset + istOffset).getUTCDate();

  if (currentIstDate !== lastIstDate) {
    logInfo('New IST day detected. Resetting daily PnL stats.');
    await sql`UPDATE app_state SET value = 0 WHERE key = 'daily_pnl'`;
    await sql`UPDATE app_state SET value = ${Date.now()} WHERE key = 'last_pnl_reset'`;
  }
}

async function isBotActive() {
  await resetDailyPnlIfNeeded();
  const { dailyPnl } = await getDailyState();
  const balance = await getBalance();
  
  const pnlPercent = (dailyPnl / balance) * 100;

  if (pnlPercent <= MAX_DAILY_LOSS_LIMIT) {
    logInfo('Daily loss limit reached. Trading paused.', { pnlPercent });
    return false;
  }
  if (pnlPercent >= MAX_DAILY_PROFIT_TARGET) {
    logInfo('Daily profit target reached. Trading paused.', { pnlPercent });
    return false;
  }
  return true;
}

async function createTrade(signal) {
    try {
        if (!(await isBotActive())) return;

        const candles = getCandles();
        const lastCandle = candles.at(-1);
        if (!lastCandle) return;

        const balance = await getBalance();

        const trade = createTradeModel({
            type: signal,
            entry: lastCandle.close,
            time: lastCandle.time,
            low: lastCandle.low,
            high: lastCandle.high,
            balance: balance
        });

        // Save to DB
        await sql`
            INSERT INTO trades (id, type, entry, entry_time, sl, tp, quantity, amount, created_at)
            VALUES (${trade.id}, ${trade.type}, ${trade.entry}, ${trade.entryTime}, ${trade.sl}, ${trade.tp}, ${trade.quantity}, ${trade.amount}, ${trade.createdAt})
        `;

        logTrade(trade);
        return trade;
    } catch (err) {
        logError('Error creating trade in DB', err);
    }
}

async function evaluateTrades() {
    try {
        await resetDailyPnlIfNeeded();
        const candles = getCandles();
        const lastCandle = candles.at(-1);
        if (!lastCandle) return;

        // Fetch all open trades
        const openTrades = await sql`
            SELECT * FROM trades WHERE result IS NULL
        `;

        for (const trade of openTrades) {
            let result = null;
            let exitPrice = null;

            if (trade.type === "BUY") {
              if (lastCandle.low <= trade.sl) {
                result = "LOSS";
                exitPrice = trade.sl;
              } else if (lastCandle.high >= trade.tp) {
                result = "WIN";
                exitPrice = trade.tp;
              }
            } else {
              // SELL
              if (lastCandle.high >= trade.sl) {
                result = "LOSS";
                exitPrice = trade.sl;
              } else if (lastCandle.low <= trade.tp) {
                result = "WIN";
                exitPrice = trade.tp;
              }
            }

            if (result) {
              const profitChange = (trade.type === "BUY") 
                ? (exitPrice - trade.entry) * trade.quantity
                : (trade.entry - exitPrice) * trade.quantity;

              // Update balance and daily pnl in app_state
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

              logInfo(`Trade ${trade.id} closed: ${result}`, { exitPrice, profitChange, finalBalance });
            }
        }
    } catch (err) {
        logError('Error evaluating trades in DB', err);
    }
}

async function getStats() {
    try {
        const trades = await sql`SELECT * FROM trades`;
        const balanceResult = await sql`SELECT value FROM app_state WHERE key = 'balance'`;
        const { STARTING_BALANCE } = require('../utils/config');
        
        const balance = balanceResult[0]?.value || 0;
        const total = trades.length;
        const wins = trades.filter(t => t.result === "WIN").length;
        const losses = trades.filter(t => t.result === "LOSS").length;

        const winRate = total ? (wins / total) * 100 : 0;

        return {
            balance: parseFloat(balance).toFixed(2),
            initialCapital: parseFloat(STARTING_BALANCE).toFixed(2),
            totalTrades: total,
            wins,
            losses,
            winRate: winRate.toFixed(2)
        };
    } catch (err) {
        logError('Error fetching stats from DB', err);
        return null;
    }
}

async function getRecentTrades(limit = 5) {
    try {
        const trades = await sql`
            SELECT * FROM trades 
            ORDER BY created_at DESC 
            LIMIT ${limit}
        `;
        return trades;
    } catch (err) {
        logError('Error fetching recent trades from DB', err);
        return [];
    }
}

async function getTradesPaged(page = 1, limit = 10) {
    try {
        const offset = (page - 1) * limit;
        const trades = await sql`
            SELECT * FROM trades 
            ORDER BY created_at DESC 
            LIMIT ${limit} OFFSET ${offset}
        `;
        const countResult = await sql`SELECT COUNT(*) FROM trades`;
        logInfo('Raw count result', { result: countResult[0] });
        const totalCount = parseInt(countResult[0]?.count || countResult[0]?.count_1 || Object.values(countResult[0])[0] || 0);

        logInfo(`Fetched trades page ${page}`, { count: trades.length, totalCount });

        return {
            trades,
            totalCount,
            page,
            totalPages: Math.ceil(totalCount / limit)
        };
    } catch (err) {
        logError('Error fetching paged trades from DB', err);
        return { trades: [], totalCount: 0, page, totalPages: 0 };
    }
}

module.exports = {
    createTrade,
    evaluateTrades,
    getStats,
    getRecentTrades,
    getTradesPaged
};