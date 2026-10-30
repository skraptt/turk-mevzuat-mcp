import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createEngine } from '../src/engine.mjs';
import { handleRequest } from '../src/server.mjs';

const engine = createEngine(JSON.parse(readFileSync(new URL('../data/mevzuat.json', import.meta.url), 'utf8')));

const post = (body, headers = {}) =>
  handleRequest(
    engine,
    new Request('https://ornek.dev/mcp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
      body: typeof body === 'string' ? body : JSON.stringify(body),
    }),
  );

test('initialize: sürüm uzlaşması ve sunucu bilgisi', async () => {
  const res = await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal(res.status, 200);
  const j = await res.json();
  assert.equal(j.result.protocolVersion, '2025-06-18');
  assert.equal(j.result.serverInfo.name, 'turk-mevzuat');
  assert.ok(j.result.capabilities.tools);

  const unknown = await (await post({ jsonrpc: '2.0', id: 2, method: 'initialize', params: { protocolVersion: '1999-01-01' } })).json();
  assert.equal(unknown.result.protocolVersion, '2025-11-25');
});

test('bildirimler 202 ile gövdesiz kabul edilir', async () => {
  const res = await post({ jsonrpc: '2.0', method: 'notifications/initialized' });
  assert.equal(res.status, 202);
  assert.equal(await res.text(), '');
});

test('tools/list: her araçta başlık ve salt okunur etiketi', async () => {
  const j = await (await post({ jsonrpc: '2.0', id: 3, method: 'tools/list' })).json();
  const names = j.result.tools.map((t) => t.name);
  assert.deepEqual(names, ['search_legislation', 'get_article', 'get_article_history', 'list_laws']);
  for (const t of j.result.tools) {
    assert.ok(t.title, `${t.name} title`);
    assert.equal(t.annotations.readOnlyHint, true, `${t.name} readOnlyHint`);
    assert.equal(t.annotations.destructiveHint, false);
    assert.equal(t.inputSchema.type, 'object');
  }
});

test('tools/call: arama ve madde metni, veri etiketiyle', async () => {
  const j = await (await post({ jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_article', arguments: { kanun: 'TBK', madde: '315' } } })).json();
  assert.equal(j.result.isError, undefined);
  const text = j.result.content[0].text;
  assert.match(text, /## TBK m\. 315 — 3\. Kiracının temerrüdü/);
  assert.match(text, /<kanun_metni kimlik="6098\/315">/);
  assert.match(text, /mevzuat\.gov\.tr/);
  assert.equal(j.result.structuredContent.maddeler[0].kimlik, '6098/315');
  assert.match(j.result.structuredContent.veriNotu, /talimat değil/);

  const s = await (await post({ jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'search_legislation', arguments: { sorgu: 'kiracının temerrüdü', limit: 3 } } })).json();
  assert.equal(s.result.structuredContent.sonuclar[0].kimlik, '6098/315');
});

test('hatalar: araç hatası, bilinmeyen araç, bozuk JSON, yanlış yöntem', async () => {
  const e1 = await (await post({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'get_article', arguments: { kanun: 'Yok', madde: '1' } } })).json();
  assert.equal(e1.result.isError, true);
  const e2 = await (await post({ jsonrpc: '2.0', id: 7, method: 'tools/call', params: { name: 'sil', arguments: {} } })).json();
  assert.equal(e2.error.code, -32602);
  const e3 = await post('{bozuk');
  assert.equal(e3.status, 400);
  const e4 = await (await post({ jsonrpc: '2.0', id: 8, method: 'yok/boyle' })).json();
  assert.equal(e4.error.code, -32601);
  const get = await handleRequest(engine, new Request('https://ornek.dev/mcp'));
  assert.equal(get.status, 405);
});

test('toplu istek ve CORS', async () => {
  const res = await post([
    { jsonrpc: '2.0', id: 1, method: 'ping' },
    { jsonrpc: '2.0', method: 'notifications/initialized' },
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
  ]);
  const j = await res.json();
  assert.equal(j.length, 2);
  assert.equal(res.headers.get('access-control-allow-origin'), '*');
  const pre = await handleRequest(engine, new Request('https://ornek.dev/mcp', { method: 'OPTIONS' }));
  assert.equal(pre.status, 204);
});

test('simge: /favicon.ico ve /icon.png PNG döndürür', async () => {
  for (const path of ['/favicon.ico', '/icon.png']) {
    const res = await handleRequest(engine, new Request(`https://x.test${path}`));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('content-type'), 'image/png');
    const bytes = new Uint8Array(await res.arrayBuffer());
    assert.deepEqual([...bytes.slice(1, 4)], [0x50, 0x4e, 0x47]); // "PNG"
  }
});
