import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ExaResearch } from '../src/research/exa';
import { PolymarketData } from '../src/polymarket/market-data';
const signal = () => AbortSignal.timeout(1000);
const respond = (body: unknown, status = 200): typeof fetch => async () => Response.json(body, { status });
test('Exa contract preserves provenance, missing dates and marked truncation', async () => {
  const exa = new ExaResearch('test-only', respond({ results: [{ url: 'https://example.com/a', text: 'x'.repeat(7000), title: 'Evidence' }], costDollars: { total: 0.01 } }));
  const { sources } = await exa.search('evidence', signal());
  assert.equal(sources[0]?.content.length, 6000); assert.equal(sources[0]?.truncated, true);
  assert.equal(sources[0]?.publishedAt, null); assert.equal(sources[0]?.provider, 'exa');
  assert.deepEqual(sources[0]?.providerUsage, { total: 0.01 });
  assert.equal((await exa.read('https://example.com/a', signal())).id, sources[0]?.id);
});
test('provider failures, incomplete sources and invalid input are errors', async () => {
  await assert.rejects(new ExaResearch('test', respond({}, 429)).search('x', signal()), { code: 'PROVIDER_HTTP_429' });
  await assert.rejects(new ExaResearch('test', respond({ results: [{ url: 'https://example.com' }] })).search('x', signal()), { code: 'INVALID_PROVIDER_RESPONSE' });
  await assert.rejects(new ExaResearch('test', respond({ results: [] })).read('https://example.com', signal()), { code: 'INVALID_PROVIDER_RESPONSE' });
  assert.throws(() => new ExaResearch('test').search('', signal()), { code: 'INVALID_INPUT' });
  const controller = new AbortController(); controller.abort();
  await assert.rejects(new ExaResearch('test', async (_url, init) => { init?.signal?.throwIfAborted(); return Response.json({}); }).search('x', controller.signal), { code: 'PROVIDER_TIMEOUT' });
});
test('order book validates outcome, timestamp, fractional prices and sorting', async () => {
  const book = { asset_id: '99', timestamp: String(Date.now()), bids: [], asks: [{ price: '0.7', size: '2' }, { price: '0.2', size: '3' }] };
  assert.equal((await new PolymarketData(respond(book)).book('99', signal())).asks[0]?.price, '0.2');
  await assert.rejects(new PolymarketData(respond(book)).book('98', signal()), { code: 'INVALID_PROVIDER_RESPONSE' });
  await assert.rejects(new PolymarketData(respond({ ...book, timestamp: '1' })).book('99', signal()), { code: 'STALE_QUOTE' });
  await assert.rejects(new PolymarketData(respond({ ...book, asks: [{ price: '2.0', size: '1' }] })).book('99', signal()), { code: 'INVALID_PROVIDER_RESPONSE' });
  assert.deepEqual((await new PolymarketData(respond({ ...book, asks: [] })).book('99', signal())).asks, []);
});
test('market rules and category membership are independently fetched', async () => {
  const paths: string[] = [];
  const provider = new PolymarketData(async url => {
    paths.push(String(url));
    return Response.json(String(url).endsWith('/tags') ? [{ id: '7', label: 'Test category' }] : { id: '1', question: 'Test?', description: 'Official resolution condition', active: true, closed: false, outcomes: '["Yes","No"]', clobTokenIds: '["99","100"]', liquidityNum: 12 });
  });
  const market = await provider.get('1', signal());
  assert.deepEqual(market.categoryIds, ['7']); assert.equal(market.rules, 'Official resolution condition');
  assert.equal(paths.length, 2);
  await assert.rejects(provider.list([], signal()), { code: 'CATEGORIES_REQUIRED' });
});

test('empty Exa search preserves reported usage without fabricating evidence', async () => {
  const result = await new ExaResearch('test', respond({ results: [], costDollars: { total: 0.01 } })).search('no results', signal());
  assert.deepEqual(result, { sources: [], usage: { total: 0.01 } });
});
