const { neon } = require('@neondatabase/serverless');
const { DATABASE_URL, STARTING_BALANCE } = require('./config');
const { logInfo, logError } = require('./logger');

if (!DATABASE_URL) {
  logError('DATABASE_URL is not defined in environment variables');
  process.exit(1);
}

const sql = neon(DATABASE_URL);

async function initDb() {
  try {
    logInfo('Initializing Database...');

    // Create trades table
    await sql`
      CREATE TABLE IF NOT EXISTS trades (
        id BIGINT PRIMARY KEY,
        type TEXT NOT NULL,
        entry DOUBLE PRECISION NOT NULL,
        exit DOUBLE PRECISION,
        entry_index INTEGER NOT NULL,
        expiry_index INTEGER NOT NULL,
        amount DOUBLE PRECISION NOT NULL,
        result TEXT,
        balance_after DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP
      )
    `;

    // Ensure balance_after column exists (Migration)
    await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS balance_after DOUBLE PRECISION`;

    // Backfill balance_after for old trades if needed
    const { PAYOUT } = require('./config');
    const needsBackfill = await sql`SELECT id FROM trades WHERE result IS NOT NULL AND balance_after IS NULL LIMIT 1`;
    if (needsBackfill.length > 0) {
      logInfo('Historical trades detected without balance data. Starting backfill...');
      const allTrades = await sql`SELECT * FROM trades WHERE result IS NOT NULL ORDER BY closed_at ASC`;
      let runningBalance = STARTING_BALANCE;
      for (const t of allTrades) {
        const profit = t.result === 'WIN' ? (t.amount * PAYOUT) : -t.amount;
        runningBalance += profit;
        await sql`UPDATE trades SET balance_after = ${runningBalance} WHERE id = ${t.id}`;
      }
      logInfo('Backfill completed.');
    }

    // Create candles table (optional, for persistent history)
    await sql`
      CREATE TABLE IF NOT EXISTS candles (
        time BIGINT PRIMARY KEY,
        open DOUBLE PRECISION NOT NULL,
        high DOUBLE PRECISION NOT NULL,
        low DOUBLE PRECISION NOT NULL,
        close DOUBLE PRECISION NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create settings/stats table for balance
    await sql`
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value DOUBLE PRECISION NOT NULL
      )
    `;

    // Initialize balance if not exists
    const balanceExists = await sql`SELECT * FROM app_state WHERE key = 'balance'`;
    if (balanceExists.length === 0) {
      await sql`INSERT INTO app_state (key, value) VALUES ('balance', ${STARTING_BALANCE})`;
    }

    logInfo('Database initialized successfully');
  } catch (err) {
    logError('Failed to initialize database', err);
    throw err;
  }
}

module.exports = {
  sql,
  initDb
};
