#!/usr/bin/env node
/**
 * Single entrypoint for Railway so both web and worker use the same start command.
 * Set RAILWAY_PROCESS=worker on the worker service; leave unset for web.
 * Runs db:migrate (and optionally db:check) when DATABASE_URL is set, then starts server/worker.
 */
require('dotenv').config();
const { loadEnv } = require('./config/env');
loadEnv();
// So the child process (server/worker) does not print the same env warnings again
process.env.AICFO_ENV_WARNINGS_PRINTED = '1';

const { spawn, spawnSync } = require('child_process');
const path = require('path');

const cwd = path.resolve(__dirname, '..');

// Run migrations before starting when DATABASE_URL is set (production/staging); skip in test
if (process.env.DATABASE_URL) {
  console.log('Running db:migrate...');
  const migrate = spawnSync(process.execPath, ['src/db/migrate.js'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: false
  });
  if (migrate.status !== 0) {
    console.error('db:migrate failed with exit code', migrate.status);
    process.exit(1);
  }
  console.log('db:migrate completed');

  // Optional schema check (catches missing columns like companies.created_at)
  const dbCheck = spawnSync(process.execPath, ['src/db/migrate.js', '--check'], {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: false
  });
  if (dbCheck.status !== 0) {
    console.error('db:check failed with exit code', dbCheck.status);
    process.exit(1);
  }
}

console.log('Starting backend...');
const isWorker = String(process.env.RAILWAY_PROCESS || '').toLowerCase() === 'worker';
const script = isWorker ? 'src/worker/worker.js' : 'src/server.js';
console.log(`RAILWAY_PROCESS=${process.env.RAILWAY_PROCESS || '(web)'} -> node ${script}`);

const child = spawn(
  process.execPath,
  [script],
  {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: false
  }
);

child.on('exit', (code, signal) => {
  process.exit(code != null ? code : signal ? 128 + signal : 0);
});

child.on('error', (err) => {
  console.error('Entrypoint failed to start:', err);
  process.exit(1);
});
