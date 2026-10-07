import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';

const envPath = resolve('.env');
if (existsSync(envPath)) {
  const fileValues = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of fileValues) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || process.env[match[1]]) continue;
    const value = match[2].replace(/^(?:"([\s\S]*)"|'([\s\S]*)')$/, (_, doubleQuoted, singleQuoted) => doubleQuoted ?? singleQuoted);
    process.env[match[1]] = value;
  }
}

const runtimeConfig = {
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
};

writeFileSync(resolve('public/runtime-config.js'), `window.__SUPPORT_WORKSPACE_CONFIG__ = ${JSON.stringify(runtimeConfig)};\n`);

const child = spawn('ng', process.argv.slice(2), { stdio: 'inherit', shell: process.platform === 'win32' });
child.on('error', (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.on('exit', (code, signal) => {
  process.exitCode = signal ? 1 : code ?? 1;
});
