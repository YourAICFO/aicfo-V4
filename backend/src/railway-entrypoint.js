#!/usr/bin/env node
/**
 * Single entrypoint for Railway so both web and worker use the same start command.
 * Set RAILWAY_PROCESS=worker on the worker service; leave unset for web.
 * No reliance on railway.toml startCommand or shell.
 */
const { spawn } = require('child_process');
const path = require('path');

const isWorker = String(process.env.RAILWAY_PROCESS || '').toLowerCase() === 'worker';
const script = isWorker ? 'src/worker/worker.js' : 'src/server.js';
const cwd = path.resolve(__dirname, '..');

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
