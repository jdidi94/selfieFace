#!/usr/bin/env node
/**
 * Staging / pre-production smoke checks against a running API (+ optional storefront).
 *
 * Usage:
 *   node scripts/smoke-staging.mjs
 *   API_URL=https://api.example.com/api SITE_URL=https://shop.example.com node scripts/smoke-staging.mjs
 */

const apiUrl = (process.env.API_URL ?? process.env.NEST_API_URL ?? 'http://localhost:4000/api').replace(
  /\/$/,
  '',
);
const siteUrl = (process.env.SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '');

const checks = [];

async function check(name, fn) {
  try {
    await fn();
    checks.push({ name, ok: true });
    console.log(`✓ ${name}`);
  } catch (err) {
    checks.push({ name, ok: false, error: err instanceof Error ? err.message : String(err) });
    console.error(`✗ ${name}: ${err instanceof Error ? err.message : err}`);
  }
}

async function getJson(path, expectStatus = 200) {
  const res = await fetch(`${apiUrl}${path}`);
  if (res.status !== expectStatus) {
    throw new Error(`Expected ${expectStatus}, got ${res.status} for ${path}`);
  }
  return res.json();
}

await check('GET /health', async () => {
  const body = await getJson('/health');
  if (!body.status || !body.database) throw new Error('Invalid health payload');
});

await check('GET /health/live', async () => {
  await getJson('/health/live');
});

await check('GET /health/ready', async () => {
  const res = await fetch(`${apiUrl}/health/ready`);
  if (res.status !== 200 && res.status !== 503) {
    throw new Error(`Unexpected status ${res.status}`);
  }
});

await check('GET /products', async () => {
  const body = await getJson('/products?currency=USD&locale=en&page=1&pageSize=4');
  if (!Array.isArray(body.items)) throw new Error('Missing items');
});

await check('GET /merchandising/rails', async () => {
  const body = await getJson('/merchandising/rails?currency=USD&locale=en&limit=4');
  if (!body.top || !body.new || !body.incoming) throw new Error('Missing rails');
});

await check('GET /categories', async () => {
  const body = await getJson('/categories?locale=en');
  if (!Array.isArray(body)) throw new Error('Expected category list');
});

if (siteUrl) {
  await check('Storefront /', async () => {
    const res = await fetch(siteUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  await check('Storefront /shop', async () => {
    const res = await fetch(`${siteUrl}/shop`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  await check('Storefront /robots.txt', async () => {
    const res = await fetch(`${siteUrl}/robots.txt`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
  await check('Storefront /sitemap.xml', async () => {
    const res = await fetch(`${siteUrl}/sitemap.xml`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  });
}

const failed = checks.filter((c) => !c.ok);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length ? 1 : 0);
