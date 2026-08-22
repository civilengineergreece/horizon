import { writeFile, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';

const key = process.env.SERPAPI_API_KEY;
if (!key) {
  console.error('Missing build secret SERPAPI_API_KEY. Add it in Cloudflare Workers Builds > Build Variables and Secrets.');
  process.exit(1);
}

const secretFile = join(tmpdir(), `horizon-secrets-${crypto.randomUUID()}.json`);
await writeFile(secretFile, JSON.stringify({ SERPAPI_API_KEY: key }), { mode: 0o600 });

try {
  const child = spawn('npx', ['wrangler', 'deploy', '--secrets-file', secretFile], {
    stdio: 'inherit',
    shell: process.platform === 'win32'
  });
  const code = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', c => resolve(c ?? 1));
  });
  process.exitCode = code;
} finally {
  await unlink(secretFile).catch(() => {});
}
