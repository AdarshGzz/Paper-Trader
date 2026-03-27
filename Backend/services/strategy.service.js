const { calculateIndicators } = require('./indicator.service');
const { getLastCandle, getPrevCandle } = require('./candle.service');

function generateSignal() {
  const indicators = calculateIndicators();
  if (!indicators) return null;

  const { ema50, rsi } = indicators;

  const lastCandle = getLastCandle();
  const prevCandle = getPrevCandle();

  if (!lastCandle || !prevCandle) return null;

  const lastEMA = ema50.at(-1);
  const lastRSI = rsi.at(-1);

  // BUY condition
  if (
    lastCandle.close > lastEMA &&
    prevCandle.close <= lastEMA && // pullback
    lastRSI > 50 &&
    lastCandle.close > lastCandle.open
  ) {
    return "BUY";
  }

  // SELL condition
  if (
    lastCandle.close < lastEMA &&
    prevCandle.close >= lastEMA &&
    lastRSI < 50 &&
    lastCandle.close < lastCandle.open
  ) {
    return "SELL";
  }

  return null;
}

module.exports = {
  generateSignal
};