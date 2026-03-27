function createCandleModel({ open, high, low, close, time }) {
  return {
    open,
    high,
    low,
    close,
    time,
    createdAt: new Date()
  };
}

module.exports = {
  createCandleModel
};
