function getWinRate(trades) {
  const total = trades.length;
  if (total === 0) return 0;

  const wins = trades.filter(t => t.result === "WIN").length;
  return ((wins / total) * 100).toFixed(2);
}

function getActiveTrade(trades) {
  return trades.find(t => !t.result);
}

function formatPrice(price) {
  return Number(price).toFixed(2);
}

module.exports = {
  getWinRate,
  getActiveTrade,
  formatPrice
};