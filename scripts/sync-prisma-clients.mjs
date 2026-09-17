import { cpSync, existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pnpmDir = join(root, 'node_modules', '.pnpm');

if (!existsSync(pnpmDir)) process.exit(0);

const clients = readdirSync(pnpmDir).filter((name) => name.startsWith('@prisma+client@'));
const withGenerated = clients
  .map((name) => ({
    name,
    prismaDir: join(pnpmDir, name, 'node_modules', '.prisma'),
  }))
  .filter((entry) => existsSync(join(entry.prismaDir, 'client', 'index.d.ts')));

let source = withGenerated[0];
let newestMtime = 0;
for (const entry of withGenerated) {
  const indexPath = join(entry.prismaDir, 'client', 'index.d.ts');
  const mtime = statSync(indexPath).mtimeMs;
  if (mtime > newestMtime) {
    newestMtime = mtime;
    source = entry;
  }
}

if (!source) process.exit(0);

for (const client of clients) {
  if (client === source.name) continue;
  const targetPrisma = join(pnpmDir, client, 'node_modules', '.prisma');
  const targetParent = join(pnpmDir, client, 'node_modules');
  if (!existsSync(targetParent)) continue;
  rmSync(targetPrisma, { recursive: true, force: true });
  cpSync(source.prismaDir, targetPrisma, { recursive: true });
}
