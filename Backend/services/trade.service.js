const { sql } = require('../utils/db');
const { getCandles } = require('./candle.service');
const { createTradeModel } = require('../models/trade.model');
const { TRADE_AMOUNT, PAYOUT } = require('../utils/config');
const { logInfo, logError, logTrade } = require('../utils/logger');

async function createTrade(signal) {
    try {
        const candles = getCandles();
        const lastCandle = candles.at(-1);

        if (!lastCandle) return;

        const trade = createTradeModel({
            type: signal,
            entry: lastCandle.close,
            index: candles.length - 1,
            amount: TRADE_AMOUNT
        });

        // Save to DB
        await sql`
            INSERT INTO trades (id, type, entry, entry_index, expiry_index, amount, created_at)
            VALUES (${trade.id}, ${trade.type}, ${trade.entry}, ${trade.entryIndex}, ${trade.expiryIndex}, ${trade.amount}, ${trade.createdAt})
        `;

        logTrade(trade);
        return trade;
    } catch (err) {
        logError('Error creating trade in DB', err);
    }
}

async function evaluateTrades() {
    try {
        const candles = getCandles();
        const currentIndex = candles.length - 1;
        const lastCandle = candles.at(-1);

        if (!lastCandle) return;

        // Fetch open trades that have reached expiry
        const openTrades = await sql`
            SELECT * FROM trades 
            WHERE result IS NULL AND ${currentIndex} >= expiry_index
        `;

        for (const trade of openTrades) {
            const exitPrice = lastCandle.close;
            let result = "LOSS";
            let profitChange = -trade.amount;

            if (
                (trade.type === "BUY" && exitPrice > trade.entry) ||
                (trade.type === "SELL" && exitPrice < trade.entry)
            ) {
                result = "WIN";
                profitChange = trade.amount * PAYOUT;
            }

            // Update balance in app_state
            const updatedBalanceResult = await sql`
                UPDATE app_state 
                SET value = value + ${profitChange}
                WHERE key = 'balance'
                RETURNING value
            `;
            
            const finalBalance = updatedBalanceResult[0]?.value;

            // Update trade in DB
            await sql`
                UPDATE trades 
                SET exit = ${exitPrice}, result = ${result}, balance_after = ${finalBalance}, closed_at = NOW()
                WHERE id = ${trade.id}
            `;

            logInfo(`Trade ${trade.id} evaluated: ${result}`, { exitPrice, profitChange, finalBalance });
        }
    } catch (err) {
        logError('Error evaluating trades in DB', err);
    }
}

async function getStats() {
    try {
        const trades = await sql`SELECT * FROM trades`;
        const balanceResult = await sql`SELECT value FROM app_state WHERE key = 'balance'`;
        
        const balance = balanceResult[0]?.value || 0;
        const total = trades.length;
        const wins = trades.filter(t => t.result === "WIN").length;
        const losses = trades.filter(t => t.result === "LOSS").length;

        const winRate = total ? (wins / total) * 100 : 0;

        return {
            balance: parseFloat(balance).toFixed(2),
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

async function getRecentTrades(limit = 10) {
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

module.exports = {
    createTrade,
    evaluateTrades,
    getStats,
    getRecentTrades
};