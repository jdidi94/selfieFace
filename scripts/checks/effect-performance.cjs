// Local regression checks: no database, credentials, browser, or network required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const read = (path) => fs.readFileSync(path, 'utf8');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

async function verificationCheck() {
  const refs = [], states = [];
  let cursor = 0, effect, calls = 0, refreshes = 0;
  let accessToken = 'first-session';
  const react = {
    useRef(value) { const i = cursor++; return refs[i] ??= { current: value }; },
    useState(value) { const i = cursor++; states[i] ??= value; return [states[i], (v) => { states[i] = v; }]; },
    useEffect(fn) { effect = fn; },
  };
  const context = {
    exports: {},
    require(name) {
      if (name === 'react') return react;
      if (name === '@lumea/ui') return { cn: () => '' };
      if (name === 'react/jsx-runtime') return { jsx: () => null, jsxs: () => null };
      if (name === '@/lib/auth-context') return { useAuth: () => ({ accessToken, refreshSession: async () => { refreshes++; accessToken = 'rotated-session'; } }) };
      if (name === '@/lib/locale-context') return { useLocale: () => ({ locale: 'en' }) };
      if (name === '@/lib/messages') return { getMessages: () => ({}) };
      if (name === 'next/navigation') return { useSearchParams: () => new URLSearchParams('token=verify-one'), useRouter: () => ({}) };
      return {};
    },
    fetch: async () => { calls++; return { ok: true, json: async () => ({}) }; },
  };
  vm.runInNewContext(compile(read('apps/client/app/account/verify-email/page.tsx') + '\nexport { VerifyEmailInner };'), context);
  const render = () => { cursor = 0; context.exports.VerifyEmailInner(); };
  render();
  effect()(); // StrictMode setup and cleanup.
  const cleanup = effect(); // Replay must share the pending verification.
  await flush();
  cleanup();
  render();
  effect(); // The refreshed access token must not verify/refresh again.
  await flush();
  assert.equal(calls, 1);
  assert.equal(refreshes, 1);
  console.log('PASS verification: effect replay and token rotation make one verification and one refresh');
}

async function wishlistCheck() {
  let calls = 0, release;
  const context = {
    exports: {}, AbortSignal,
    require: () => ({}),
    fetch: () => { calls++; return new Promise((resolve) => { release = () => resolve({ ok: true, json: async () => ['product'] }); }); },
  };
  vm.runInNewContext(compile(read('apps/client/components/wishlist-heart-button.tsx')), context);
  const requests = Array.from({ length: 24 }, () => context.exports.loadWishlistIds('customer'));
  assert.equal(calls, 1);
  release();
  const results = await Promise.all(requests);
  assert(results.every((ids) => ids.includes('product')));
  const next = context.exports.loadWishlistIds('customer');
  assert.equal(calls, 2); // No stale result cache after completion.
  release(); await next;
  console.log('PASS wishlist: 24 simultaneous cards share one request; later requests remain fresh');
}

async function checkoutCheck() {
  const source = read('apps/client/app/checkout/page.tsx');
  const ast = ts.createSourceFile('checkout.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isCallExpression(node) && node.expression.getText(ast) === 'useEffect' && node.arguments[0]?.getText(ast).includes('const updateOptions')) callback = node.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast); assert(callback);
  let timer, refreshes = 0, options = 0, quotes = 0, release;
  const listeners = new Map();
  const context = {
    exports: {}, URL, AbortSignal, AbortController, currency: 'USD', apiUrl: 'http://example.test/api',
    document: { visibilityState: 'visible', addEventListener: (n, f) => listeners.set(n, f), removeEventListener: (n) => listeners.delete(n) },
    window: { setInterval: () => 1, clearInterval() {}, addEventListener: (n, f) => listeners.set(n, f), removeEventListener: (n) => listeners.delete(n) },
    setTimeout: (fn) => { timer = fn; return 1; }, clearTimeout: () => { timer = undefined; },
    io: () => ({ on: (n, f) => listeners.set(n, f), off: (n) => listeners.delete(n), disconnect() {} }),
    fetch: async () => { options++; return { ok: true, json: async () => ({ cashEnabled: true }) }; },
    refresh: () => { refreshes++; return new Promise((resolve) => { release = resolve; }); },
    setPaymentOptions() {}, setCheckoutLoadError() {}, setPaymentMethod() {}, setQuoteRefreshSeq: () => { quotes++; },
  };
  vm.runInNewContext(compile(`exports.setup = ${callback}`), context);
  const cleanup = context.exports.setup();
  for (let i = 0; i < 20; i++) listeners.get('checkout:changed')();
  timer(); timer = undefined;
  assert.equal(refreshes, 1); assert.equal(options, 1);
  listeners.get('focus')(); listeners.get('visibilitychange')();
  assert.equal(refreshes, 1); // Still in flight.
  release(); await flush();
  assert.equal(quotes, 1); assert(timer); // One trailing refresh preserves invalidations.
  timer(); timer = undefined;
  assert.equal(refreshes, 2);
  cleanup(); release(); await flush();
  assert.equal(quotes, 1); assert.equal(listeners.size, 0); assert.equal(timer, undefined);
  console.log('PASS checkout: bursts coalesce, requests do not overlap, cleanup removes listeners and state updates');
}

async function cartCheck() {
  const source = read('apps/client/lib/cart-context.tsx');
  const ast = ts.createSourceFile('cart.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let callback;
  function visit(node) {
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === 'refresh' && ts.isCallExpression(node.initializer)) callback = node.initializer.arguments[0].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  let calls = 0, release, applied = 0;
  const context = {
    exports: {}, AbortSignal, currency: 'USD', apiUrl: 'http://example.test/api',
    cartHeaders: () => ({}), refreshInFlight: { current: null }, refreshSequence: { current: 0 },
    setError() {}, applyCart: () => { applied++; },
    fetch: () => { calls++; return new Promise((resolve) => { release = () => resolve({ ok: true, json: async () => ({ id: 'cart' }) }); }); },
  };
  vm.runInNewContext(compile(`exports.refresh = ${callback}`), context);
  const first = context.exports.refresh();
  const second = context.exports.refresh();
  assert.equal(first, second); assert.equal(calls, 1);
  release(); await first;
  assert.equal(applied, 1);
  const third = context.exports.refresh(); assert.equal(calls, 2);
  release(); await third;
  console.log('PASS cart: concurrent refreshes share one request and one state update');
}

(async () => { await verificationCheck(); await wishlistCheck(); await checkoutCheck(); await cartCheck(); })().catch((error) => { console.error(error); process.exitCode = 1; });
