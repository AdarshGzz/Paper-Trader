function createTradeModel({ type, entry, index, amount = 10 }) {
  return {
    id: Date.now(),

    type, // "BUY" | "SELL"

    entry, // entry price
    exit: null,

    entryIndex: index,
    expiryIndex: index + 1, // next candle

    amount,

    result: null, // "WIN" | "LOSS"

    createdAt: new Date(),
    closedAt: null
  };
}

module.exports = {
  createTradeModel
};