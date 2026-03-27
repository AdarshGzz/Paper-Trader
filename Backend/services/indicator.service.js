const { EMA, RSI } = require('technicalindicators');
const { getCandles } = require('./candle.service');

function calculateIndicators() {
  const candles = getCandles();
  const closes = candles.map(c => c.close);

  if (closes.length < 50) return null;

  const ema50 = EMA.calculate({
    period: 50,
    values: closes
  });

  const rsi = RSI.calculate({
    period: 14,
    values: closes
  });

  return {
    ema50,
    rsi
  };
}

module.exports = {
  calculateIndicators
};