import { readdir } from 'fs/promises';
import path from 'path';

const root = process.cwd();
const ignoreDirs = new Set([
  '.git',
  'node_modules',
  'dist',
  '.cli-sessions',
  'coverage',
  '.next',
  '.vercel'
]);

const allowedFiles = new Set([
  'vite.config.ts',
  'vite-env.d.ts'
]);

async function walk(dir, violations) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    const relPath = path.posix.normalize(path.relative(root, entryPath).split(path.sep).join('/'));

    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      await walk(entryPath, violations);
      continue;
    }

    const isTsFile = entry.name.endsWith('.ts') || entry.name.endsWith('.tsx');
    if (!isTsFile) continue;

    const isSrcFile = relPath.startsWith('src/');
    const isAllowedRootFile = allowedFiles.has(relPath);

    if (!isSrcFile && !isAllowedRootFile) {
      violations.push(relPath);
    }
  }
}

async function main() {
  const violations = [];
  await walk(root, violations);

  if (violations.length > 0) {
    console.error('Found unexpected TypeScript files outside src/:');
    violations.forEach(file => console.error(` - ${file}`));
    console.error('\nMove application code under src/ to keep the build consistent.');
    process.exitCode = 1;
    return;
  }

  console.log('Structure check passed: all TypeScript sources are confined to src/.');
}

main().catch(err => {
  console.error('Failed to complete structure check:', err);
  process.exit(1);
});
