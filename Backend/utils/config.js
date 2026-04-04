require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3001,
  DATABASE_URL: process.env.DATABASE_URL,
  BINANCE_WS_URL: process.env.BINANCE_WS_URL || 'wss://stream.binance.com:9443/stream?streams=btcusdt@kline_5m/btcusdt@aggTrade',
  TRADE_AMOUNT: parseFloat(process.env.TRADE_AMOUNT) || 10,
  STARTING_BALANCE: parseFloat(process.env.STARTING_BALANCE) || 1000,
  PAYOUT: parseFloat(process.env.PAYOUT) || 0.8,
  MAX_CANDLES: parseInt(process.env.MAX_CANDLES) || 100,

  // Advanced Strategy Management
  RISK_PER_TRADE_PERCENT: 1, // Risk 1% of balance per trade
  MAX_DAILY_LOSS_LIMIT: -3,   // Stop trading if down 3% today
  MAX_DAILY_PROFIT_TARGET: 5, // Stop trading if up 5% today
  STOP_LOSS_BUFFER: 10,       // $10 below/above candle low/high
  TAKE_PROFIT_MULTIPLIER: 1.5 // 1.5x Risk-to-Reward ratio
};
