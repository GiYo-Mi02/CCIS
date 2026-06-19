import { spawn } from 'child_process';

console.log('[Dev Coordinator] Launching CCIS central services...');

// Spawn Vite Dev Server
const viteProcess = spawn('npx', ['vite', '--port=3000', '--host=0.0.0.0'], {
  stdio: 'inherit',
  shell: true
});

// Spawn local background Email Worker
const workerProcess = spawn('node', ['email_worker.js'], {
  stdio: 'inherit',
  shell: true
});

const cleanup = () => {
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
  cleanup();
});
