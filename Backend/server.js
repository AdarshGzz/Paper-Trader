const { connect } = require('./websocket/exchange');
const { initDb } = require('./utils/db');
const { loadCandlesFromDb } = require('./services/candle.service');
const { logInfo, logError } = require('./utils/logger');
require('./websocket/server');

async function start() {
    try {
        await initDb();
        await loadCandlesFromDb();
        connect();
        logInfo('PaperTrader Backend started');
    } catch (err) {
        logError('Failed to start PaperTrader', err);
        process.exit(1);
    }
}

start();