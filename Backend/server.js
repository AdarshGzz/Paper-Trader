const { connect } = require('./websocket/exchange');
const { initDb } = require('./utils/db');
const { loadCandlesFromDb, syncMissingCandles } = require('./services/candle.service');
const { logInfo, logError } = require('./utils/logger');
const { startWsServer } = require('./websocket/server');

async function start() {
    try {
        // 1. Critical Initialization
        await initDb();
        await loadCandlesFromDb(); // Load what we have instantly
        
        // 2. Start Networking (Frontend can connect now)
        startWsServer();
        
        // 3. Connect to Live Market Stream
        connect(); 

        // 4. Multi-Tasking: Historical Sync in Background
        // We don't 'await' this so the server is "started" immediately
        syncMissingCandles().then(() => {
          logInfo('Historical gap sync completed in background.');
        }).catch(err => {
          logError('Background sync task failed', err.message);
        });

        logInfo('PaperTrader Backend started - Dashboard is now LIVE');
    } catch (err) {
        logError('Failed to start PaperTrader', err.message);
        process.exit(1);
    }
}

start();