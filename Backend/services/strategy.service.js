const { calculateIndicators } = require('./indicator.service');
const { getLastCandle, getPrevCandle } = require('./candle.service');

function isTimeInTradeRange() {
  const now = new Date();
  // IST is UTC + 5:30
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(now.getTime() + istOffset);
  
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  const totalMinutes = (hours * 60) + minutes;

  // Rule 1: Trade 12:30 PM to 8:30 PM IST
  const tradeStart = (12 * 60) + 30; // 750
  const tradeEnd = (20 * 60) + 30;   // 1230
  
  const inTradeWindow = totalMinutes >= tradeStart && totalMinutes <= tradeEnd;

  // Rule 2: Avoid 4:30 AM to 7:30 AM IST (wick zone)
  const avoidStart = (4 * 60) + 30; // 270
  const avoidEnd = (7 * 60) + 30;   // 450
  const inAvoidWindow = totalMinutes >= avoidStart && totalMinutes <= avoidEnd;

  return inTradeWindow && !inAvoidWindow;
}

function generateSignal() {
  // Check time filter
  if (!isTimeInTradeRange()) return null;

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