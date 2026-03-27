require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  DATABASE_URL: process.env.DATABASE_URL,
  BINANCE_WS_URL: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/ws/btcusdt@kline_5m',
  TRADE_AMOUNT: parseFloat(process.env.TRADE_AMOUNT) || 10,
  STARTING_BALANCE: parseFloat(process.env.STARTING_BALANCE) || 1000,
  PAYOUT: parseFloat(process.env.PAYOUT) || 0.8,
  MAX_CANDLES: parseInt(process.env.MAX_CANDLES) || 100
};
