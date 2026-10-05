const app = require('./app');
const config = require('./config/env');
const pool = require('./config/db');

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDatabase(attempts = 30) {
  for (let i = 1; i <= attempts; i += 1) {
    try {
      await pool.query('SELECT 1');
      return;
    } catch (err) {
      console.log(`[db] waiting for MySQL (${i}/${attempts}): ${err.code || err.message}`);
      await sleep(2000);
    }
  }
  throw new Error('MySQL is not reachable');
}

async function main() {
  await waitForDatabase();
  const server = app.listen(config.port, () => console.log(`[server] CineOpt API listening on port ${config.port}`));
  const shutdown = () => server.close(() => pool.end().finally(() => process.exit(0)));
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[server] fatal:', err.message);
  process.exit(1);
});
