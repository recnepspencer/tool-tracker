import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { cp, mkdir } from 'node:fs/promises';
import { connect, createServer } from 'node:net';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const backend = resolve(root, 'backend');
if (existsSync(resolve(backend, '.env'))) process.loadEnvFile(resolve(backend, '.env'));
const python = resolve(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const playwright = resolve(root, 'node_modules/@playwright/test/cli.js');
const args = process.argv.slice(2);
let interrupted = false;
let activeTest;

function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  const closed = new Promise((resolveClose) => child.once('close', resolveClose));
  if (process.platform === 'win32')
    spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
  else process.kill(-child.pid, 'SIGTERM');
  return closed;
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.on(signal, () => {
    interrupted = true;
    void stop(activeTest);
  });

async function run(executable, commandArgs, env, log) {
  const child = launch(executable, commandArgs, env, log);
  const code = await new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (status) => resolveExit(status ?? 1));
  });
  if (code !== 0) throw new Error(`${commandArgs[0]} exited with ${code}`);
}
function launch(executable, commandArgs, env, log) {
  const child = spawn(executable, commandArgs, {
    cwd: root,
    env,
    windowsHide: true,
    detached: process.platform !== 'win32',
    stdio: log ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  });
  if (log) {
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
  }
  return child;
}
async function ready(api, port) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (interrupted || api.exitCode !== null) throw new Error('Browser API stopped before becoming ready.');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/api/auth/csrf`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      /* Wait for the owned API to bind. */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error('Browser API did not become ready; inspect its log.');
}

// One Python process serialises every browser worker behind its GIL, so the suite runs
// several API processes and spreads connections across them at 8002.
function balance(ports) {
  let next = 0;
  const server = createServer((client) => {
    const upstream = connect(ports[next++ % ports.length], '127.0.0.1');
    client.pipe(upstream).pipe(client);
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
  });
  return new Promise((resolveListen, reject) => {
    server.once('error', reject);
    server.listen(8002, '127.0.0.1', () => resolveListen(server));
  });
}

async function requireFreePort(port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Browser port ${port} is already in use.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolvePort));
  });
}

// One database, API and activity worker serve the whole run. Every scenario creates its own
// company, so Playwright workers share the backend and run in parallel.
const name = `nelson_browser_${process.pid}_${randomBytes(6).toString('hex')}`;
const artifactDir = resolve(root, 'artifacts/browser-runs', name);
await mkdir(resolve(artifactDir, 'mail'), { recursive: true });
const env = {
  ...process.env,
  PYTHONUNBUFFERED: '1',
  DJANGO_DEBUG: '1',
  DJANGO_ALLOWED_HOSTS: '127.0.0.1,localhost,testserver',
  NELSON_APP_URL: 'http://127.0.0.1:4173',
  NELSON_FAST_PASSWORD_HASHING: '1',
  NELSON_TRUSTED_PROXY_IPS: '127.0.0.1',
  EMAIL_BACKEND: 'django.core.mail.backends.filebased.EmailBackend',
  POSTGRES_DB: name,
  NELSON_API_TARGET: 'http://127.0.0.1:8002',
  NELSON_BROWSER_ISOLATED: '1',
  NELSON_BROWSER_RESULTS: resolve(artifactDir, 'results'),
  NELSON_BROWSER_DIST: resolve(artifactDir, 'web'),
  NELSON_MAIL_ROOT: resolve(artifactDir, 'mail'),
  NELSON_MEDIA_ROOT: resolve(artifactDir, 'media'),
};
const log = createWriteStream(resolve(artifactDir, 'api.log'));
const workerLog = createWriteStream(resolve(artifactDir, 'worker.log'));
const apiPorts = Array.from(
  { length: Math.max(2, Math.floor(availableParallelism() / 4)) },
  (_, index) => 8003 + index,
);
let apis = [],
  balancer,
  worker,
  created = false,
  failed = false;
try {
  console.log(`Diagnostics: ${artifactDir}`);
  for (const port of [8002, 4173, ...apiPorts]) await requireFreePort(port);
  await Promise.all([
    cp(resolve(root, 'dist'), env.NELSON_BROWSER_DIST, { recursive: true }),
    run(python, ['backend/scripts/browser_database.py', 'create', name], env).then(() => (created = true)),
  ]);
  await run(python, ['backend/manage.py', 'migrate', '--noinput'], env, log);
  apis = apiPorts.map((port) => launch(python, ['backend/scripts/browser_api.py', `127.0.0.1:${port}`], env, log));
  // Scenarios wait on materialised activity, so the worker picks jobs up promptly.
  worker = launch(python, ['backend/manage.py', 'run_platform_worker', '--poll-seconds', '0.2'], env, workerLog);
  await Promise.all(apis.map((api, index) => ready(api, apiPorts[index])));
  balancer = await balance(apiPorts);
  activeTest = launch(process.execPath, [playwright, 'test', ...args], env);
  const code = await new Promise((resolveExit, reject) => {
    activeTest.once('error', reject);
    activeTest.once('exit', (status) => resolveExit(status ?? 1));
  });
  if (code !== 0) failed = true;
} catch (error) {
  console.error(error.message);
  failed = true;
} finally {
  await stop(activeTest);
  activeTest = undefined;
  await stop(worker);
  balancer?.close();
  await Promise.all(apis.map(stop));
  log.end();
  workerLog.end();
  if (created) await run(python, ['backend/scripts/browser_database.py', 'drop', name], env);
}
process.exitCode = failed || interrupted ? 1 : 0;
