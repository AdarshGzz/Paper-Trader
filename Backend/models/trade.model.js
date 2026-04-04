const { 
  STOP_LOSS_BUFFER, 
  TAKE_PROFIT_MULTIPLIER, 
  RISK_PER_TRADE_PERCENT 
} = require('../utils/config');

function createTradeModel({ type, entry, time, low, high, balance }) {
  let sl, tp;
  
  if (type === 'BUY') {
    sl = low - STOP_LOSS_BUFFER;
    const riskAmountPerCoin = entry - sl;
    tp = entry + (riskAmountPerCoin * TAKE_PROFIT_MULTIPLIER);
  } else {
    // SELL
    sl = high + STOP_LOSS_BUFFER;
    const riskAmountPerCoin = sl - entry;
    tp = entry - (riskAmountPerCoin * TAKE_PROFIT_MULTIPLIER);
  }

  // Position Sizing: Risk 1% of balance
  const totalAmountToRisk = balance * (RISK_PER_TRADE_PERCENT / 100);
  const riskPerCoin = Math.abs(entry - sl);
  
  // Guard against zero riskPerCoin to avoid Infinity
  const quantity = riskPerCoin > 0 ? totalAmountToRisk / riskPerCoin : 0;

  return {
    id: Date.now(),
    type,
    entry,
    exit: null,
    entryTime: time,
    sl,
    tp,
    quantity,
    amount: quantity * entry, // total position size in USD
    result: null,
    createdAt: new Date(),
    closedAt: null
  };
}

module.exports = {
  createTradeModel
};