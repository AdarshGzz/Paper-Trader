const { sql } = require('./utils/db');
const { logInfo, logError } = require('./utils/logger');
require('dotenv').config();

async function cleanup() {
  try {
    logInfo('Cleaning up dummy data...');
    
    // Delete trades with the specific dummy entry price or very old/weird ones
    await sql`DELETE FROM trades WHERE entry = 50500 OR id = 1774720048848`;
    
    // Delete candles with the specific dummy price
    await sql`DELETE FROM candles WHERE close = 50500`;
    
    logInfo('Cleanup complete.');
    process.exit(0);
  } catch (err) {
    logError('Cleanup failed', err);
    process.exit(1);
  }
}

cleanup();
