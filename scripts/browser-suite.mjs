import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { createWriteStream, existsSync } from 'node:fs';
import { mkdir, readdir } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const backend = resolve(root, 'backend');
if (existsSync(resolve(backend, '.env'))) process.loadEnvFile(resolve(backend, '.env'));
const python = resolve(backend, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
const playwright = resolve(root, 'node_modules/@playwright/test/cli.js');
const args = process.argv.slice(2);
const selected = args.filter((arg) => arg.endsWith('.spec.ts'));
const options = args.filter((arg) => !arg.endsWith('.spec.ts'));
const files = selected.length
  ? selected
  : (await readdir(resolve(root, 'e2e')))
      .filter((name) => name.endsWith('.spec.ts'))
      .sort()
      .map((name) => `e2e/${name}`);
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
async function ready(api) {
  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    if (interrupted || api.exitCode !== null) throw new Error('Browser API stopped before becoming ready.');
    try {
      const response = await fetch('http://127.0.0.1:8002/api/auth/csrf', { signal: AbortSignal.timeout(1000) });
      if (response.ok) return;
    } catch {
      /* Wait for the owned API to bind. */
    }
    await new Promise((resolveWait) => setTimeout(resolveWait, 200));
  }
  throw new Error('Browser API did not become ready; inspect its log.');
}

async function requireFreePort(port) {
  await new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', () => reject(new Error(`Browser port ${port} is already in use.`)));
    server.listen(port, '127.0.0.1', () => server.close(resolvePort));
  });
}

let failed = false;
for (const file of files) {
  if (interrupted) break;
  const name = `nelson_browser_${process.pid}_${randomBytes(6).toString('hex')}`;
  const artifactDir = resolve(root, 'artifacts/browser-runs', name);
  await mkdir(resolve(artifactDir, 'mail'), { recursive: true });
  const env = {
    ...process.env,
    PYTHONUNBUFFERED: '1',
    DJANGO_DEBUG: '1',
    DJANGO_ALLOWED_HOSTS: '127.0.0.1,localhost,testserver',
    NELSON_APP_URL: 'http://127.0.0.1:4173',
    EMAIL_BACKEND: 'django.core.mail.backends.filebased.EmailBackend',
    POSTGRES_DB: name,
    NELSON_API_TARGET: 'http://127.0.0.1:8002',
    NELSON_BROWSER_ISOLATED: '1',
    NELSON_BROWSER_RESULTS: resolve(artifactDir, 'results'),
    NELSON_MAIL_ROOT: resolve(artifactDir, 'mail'),
    NELSON_MEDIA_ROOT: resolve(artifactDir, 'media'),
  };
  const log = createWriteStream(resolve(artifactDir, 'api.log'));
  const workerLog = createWriteStream(resolve(artifactDir, 'worker.log'));
  let api,
    worker,
    created = false;
  try {
    console.log(`\nBrowser file: ${file}\nDiagnostics: ${artifactDir}`);
    await requireFreePort(8002);
    await requireFreePort(4173);
    await run(python, ['backend/scripts/browser_database.py', 'create', name], env);
    created = true;
    await run(python, ['backend/manage.py', 'migrate', '--noinput'], env, log);
    api = launch(python, ['backend/manage.py', 'runserver', '127.0.0.1:8002', '--noreload'], env, log);
    worker = launch(python, ['backend/manage.py', 'run_platform_worker'], env, workerLog);
    await ready(api);
    activeTest = launch(process.execPath, [playwright, 'test', file, ...options], env);
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
    await stop(api);
    log.end();
    workerLog.end();
    if (created) await run(python, ['backend/scripts/browser_database.py', 'drop', name], env);
  }
}
process.exitCode = failed || interrupted ? 1 : 0;
