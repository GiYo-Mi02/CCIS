import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

console.log('[Dev Coordinator] Launching CCIS central services...');

const viteEntry = fileURLToPath(new URL('./node_modules/vite/bin/vite.js', import.meta.url));
const workerEntry = fileURLToPath(new URL('./email_worker.js', import.meta.url));

// Spawn Vite Dev Server
const viteProcess = spawn(process.execPath, [viteEntry, '--port=3000', '--host=0.0.0.0'], {
  stdio: 'inherit'
});

// Spawn local background Email Worker
const workerProcess = spawn(process.execPath, [workerEntry], {
  stdio: 'inherit'
});

let shuttingDown = false;

const cleanup = () => {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log('\n[Dev Coordinator] Shutting down CCIS services...');
  viteProcess.kill();
  workerProcess.kill();
  process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

viteProcess.on('exit', (code) => {
  console.log(`[Dev Coordinator] Vite exited with code ${code}`);
  cleanup();
});

workerProcess.on('exit', (code) => {
  console.log(`[Dev Coordinator] Email worker exited with code ${code}`);
  if (!shuttingDown) {
    console.warn('[Dev Coordinator] Vite remains available, but local email delivery is disabled.');
  }
});
