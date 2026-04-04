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
        entry_index INTEGER,
        expiry_index INTEGER,
        entry_time BIGINT,
        expiry_time BIGINT,
        sl DOUBLE PRECISION,
        tp DOUBLE PRECISION,
        quantity DOUBLE PRECISION,
        amount DOUBLE PRECISION NOT NULL,
        result TEXT,
        balance_after DOUBLE PRECISION,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        closed_at TIMESTAMP
      )
    `;

    // Migration to ensure new columns exist
    await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS entry_time BIGINT`;
    await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS expiry_time BIGINT`;
    await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS sl DOUBLE PRECISION`;
    await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS tp DOUBLE PRECISION`;
    await sql`ALTER TABLE trades ADD COLUMN IF NOT EXISTS quantity DOUBLE PRECISION`;
    await sql`ALTER TABLE trades ALTER COLUMN entry_index DROP NOT NULL`;
    await sql`ALTER TABLE trades ALTER COLUMN expiry_index DROP NOT NULL`;

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

    // Initialize balance and daily PnL if not exists
    const stateExists = await sql`SELECT key FROM app_state WHERE key IN ('balance', 'daily_pnl', 'last_pnl_reset')`;
    const keys = stateExists.map(s => s.key);
    
    if (!keys.includes('balance')) {
      await sql`INSERT INTO app_state (key, value) VALUES ('balance', ${STARTING_BALANCE})`;
    }
    if (!keys.includes('daily_pnl')) {
      await sql`INSERT INTO app_state (key, value) VALUES ('daily_pnl', 0)`;
    }
    if (!keys.includes('last_pnl_reset')) {
      await sql`INSERT INTO app_state (key, value) VALUES ('last_pnl_reset', ${Date.now()})`;
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
