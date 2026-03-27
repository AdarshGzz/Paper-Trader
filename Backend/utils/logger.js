function logInfo(message, data = {}) {
  console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
}

function logError(message, error = {}) {
  console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, error);
}

function logTrade(trade) {
  console.log(`[TRADE] ${trade.type} | Entry: ${trade.entry} | Result: ${trade.result || "OPEN"}`);
}

module.exports = {
  logInfo,
  logError,
  logTrade
};