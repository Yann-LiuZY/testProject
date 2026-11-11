'use strict';

const fs = require('fs');
const path = require('path');
const { app, assert } = require('egg-mock/bootstrap');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
const LEGACY_ENDPOINT_IDS = [
  'test',
  'request-id',
  'request-id-invalid',
  'debug-show',
  'debug-create',
  'debug-create-query',
  'debug-conflict',
  'debug-consume',
  'debug-delete',
  'visit-show',
  'visit-open',
  'visit-open-query',
  'visit-missing',
];

const ROOT = path.join(__dirname, '../../..');
const ENDPOINTS_JS = path.join(ROOT, 'app/public/assets/js/api-debug/endpoints.js');

function assertRequestId(res) {
  const requestId = res.headers['x-request-id'];
  assert(REQUEST_ID_PATTERN.test(requestId), `invalid x-request-id: ${requestId}`);
  return requestId;
}

function visitSnapshot(store) {
  if (!store) {
    return null;
  }
  return Array.from(store.entries()).map(([ id, record ]) => [ id, { ...record }]);
}

function seedVisit(tabId, lastOpenedAt, extra = {}) {
  app.pageVisitStore.set(tabId, {
    tabId,
    lastOpenedAt,
    openedAt: lastOpenedAt,
    openCount: 1,
    requestId: 'seed0001',
    ...extra,
  });
}

describe('test/app/controller/visitAdmin.test.js', () => {
  let originalMaxTabs;

  beforeEach(() => {
    if (originalMaxTabs === undefined) {
      originalMaxTabs = app.config.pageVisit.maxTabs;
    }
    app.pageVisitStore = new Map();
  });

  after(() => {
    app.config.pageVisit.maxTabs = originalMaxTabs;
    app.pageVisitStore = new Map();
  });

  describe('POST /api/visit-admin/clear', () => {
    it('clears all records and returns removed count', async () => {
      seedVisit('tab-1', '2024-01-01T00:00:00.000Z');
      seedVisit('tab-2', '2024-01-02T00:00:00.000Z');

      const res = await app.httpRequest()
        .post('/api/visit-admin/clear')
        .send({})
        .expect(200);

      assertRequestId(res);
      assert.deepStrictEqual(res.body, { data: { removed: 2, remaining: 0 } });
      assert.strictEqual(app.pageVisitStore.size, 0);
    });

    it('returns removed 0 for empty store and missing store', async () => {
      const empty = await app.httpRequest()
        .post('/api/visit-admin/clear')
        .send({})
        .expect(200);
      assertRequestId(empty);
      assert.deepStrictEqual(empty.body.data, { removed: 0, remaining: 0 });

      const again = await app.httpRequest()
        .post('/api/visit-admin/clear')
        .expect(200);
      assert.deepStrictEqual(again.body.data, { removed: 0, remaining: 0 });

      delete app.pageVisitStore;
      const missing = await app.httpRequest()
        .post('/api/visit-admin/clear')
        .expect(200);
      assert.deepStrictEqual(missing.body.data, { removed: 0, remaining: 0 });
    });

    it('does not change debug config or pageVisit.maxTabs', async () => {
      const maxTabsBefore = app.config.pageVisit.maxTabs;
      app.config.pageVisit.maxTabs = 77;
      seedVisit('tab-1', '2024-01-01T00:00:00.000Z');

      await app.httpRequest()
        .post('/api/debug-config')
        .send({ data: { enabled: true, note: 'keep' } })
        .expect(200);

      await app.httpRequest()
        .post('/api/visit-admin/clear')
        .send({})
        .expect(200);

      const debug = await app.httpRequest()
        .get('/api/debug-config')
        .expect(200);
      assert.deepStrictEqual(debug.body.data, { enabled: true, note: 'keep' });
      assert.strictEqual(app.config.pageVisit.maxTabs, 77);
      app.config.pageVisit.maxTabs = maxTabsBefore;
    });
  });

  describe('POST /api/visit-admin/prune', () => {
    it('prunes by lastOpenedAt and honors maxTabs bounds', async () => {
      seedVisit('tab-1', '2024-01-01T00:00:00.000Z');
      seedVisit('tab-2', '2024-01-02T00:00:00.000Z');
      seedVisit('tab-3', '2024-01-03T00:00:00.000Z');

      const res = await app.httpRequest()
        .post('/api/visit-admin/prune')
        .send({ maxTabs: 1 })
        .expect(200);

      assertRequestId(res);
      assert.deepStrictEqual(res.body.data, { removed: 2, remaining: 1 });
      assert.strictEqual(app.pageVisitStore.size, 1);
      assert(app.pageVisitStore.has('tab-3'));

      app.pageVisitStore = new Map([
        [ 'x', { tabId: 'x', lastOpenedAt: '2024-01-01T00:00:00.000Z' }],
        [ 'y', { tabId: 'y', lastOpenedAt: '2024-01-02T00:00:00.000Z' }],
      ]);
      const zero = await app.httpRequest()
        .post('/api/visit-admin/prune')
        .send({ maxTabs: 0 })
        .expect(200);
      assert.deepStrictEqual(zero.body.data, { removed: 2, remaining: 0 });

      app.pageVisitStore = new Map([
        [ 'only', { tabId: 'only', lastOpenedAt: '2024-01-01T00:00:00.000Z' }],
      ]);
      const cap = await app.httpRequest()
        .post('/api/visit-admin/prune')
        .send({ maxTabs: 1000 })
        .expect(200);
      assert.deepStrictEqual(cap.body.data, { removed: 0, remaining: 1 });
    });

    it('rejects invalid maxTabs without mutating the store', async () => {
      seedVisit('tab-1', '2024-01-01T00:00:00.000Z');
      const before = visitSnapshot(app.pageVisitStore);
      const maxTabsBefore = app.config.pageVisit.maxTabs;

      const cases = [
        {},
        { maxTabs: null },
        { maxTabs: '10' },
        { maxTabs: 1.5 },
        { maxTabs: -1 },
        { maxTabs: 1001 },
      ];

      for (const body of cases) {
        const res = await app.httpRequest()
          .post('/api/visit-admin/prune')
          .send(body)
          .expect(400);
        assertRequestId(res);
        assert(typeof res.body.message === 'string' && res.body.message.length > 0);
        assert.deepStrictEqual(visitSnapshot(app.pageVisitStore), before);
        assert.strictEqual(app.config.pageVisit.maxTabs, maxTabsBefore);
      }
    });
  });

  describe('POST /api/visit-admin/touch', () => {
    it('touches tabs and sets openCount for new records', async () => {
      app.config.pageVisit.maxTabs = 100;

      const res = await app.httpRequest()
        .post('/api/visit-admin/touch')
        .send({ tabIds: [ 'a', 'b' ] })
        .expect(200);

      const requestId = assertRequestId(res);
      assert.deepStrictEqual(res.body.data, { accepted: 2, total: 2 });

      for (const tabId of [ 'a', 'b' ]) {
        const record = app.pageVisitStore.get(tabId);
        assert.strictEqual(record.openCount, 1);
        assert.strictEqual(record.openedAt, record.lastOpenedAt);
        assert.strictEqual(record.requestId, requestId);
      }
    });

    it('accumulates openCount for duplicate tabIds in one batch', async () => {
      const first = await app.httpRequest()
        .post('/api/visit-admin/touch')
        .send({ tabIds: [ 'a', 'a' ] })
        .expect(200);
      assertRequestId(first);
      assert.deepStrictEqual(first.body.data, { accepted: 2, total: 1 });
      assert.strictEqual(app.pageVisitStore.get('a').openCount, 2);

      app.pageVisitStore = new Map();
      const openedAt = '2024-06-01T00:00:00.000Z';
      app.pageVisitStore.set('a', {
        tabId: 'a',
        openedAt,
        lastOpenedAt: openedAt,
        openCount: 1,
        requestId: 'seed0001',
      });

      const second = await app.httpRequest()
        .post('/api/visit-admin/touch')
        .send({ tabIds: [ 'a', 'a' ] })
        .expect(200);
      assertRequestId(second);
      assert.strictEqual(app.pageVisitStore.get('a').openCount, 3);
      assert.strictEqual(app.pageVisitStore.get('a').openedAt, openedAt);
      assert(app.pageVisitStore.get('a').lastOpenedAt >= openedAt);
    });

    it('preserves openedAt on existing records', async () => {
      const openedAt = '2020-01-01T00:00:00.000Z';
      app.pageVisitStore.set('a', {
        tabId: 'a',
        openedAt,
        lastOpenedAt: openedAt,
        openCount: 1,
        requestId: 'old',
      });

      const res = await app.httpRequest()
        .post('/api/visit-admin/touch')
        .send({ tabIds: [ 'a' ] })
        .expect(200);

      const requestId = assertRequestId(res);
      const record = app.pageVisitStore.get('a');
      assert.strictEqual(record.openedAt, openedAt);
      assert.notStrictEqual(record.lastOpenedAt, openedAt);
      assert.strictEqual(record.requestId, requestId);
    });

    it('evicts least recently opened tabs when over maxTabs', async () => {
      app.config.pageVisit.maxTabs = 2;

      const res = await app.httpRequest()
        .post('/api/visit-admin/touch')
        .send({ tabIds: [ 'a', 'b', 'c' ] })
        .expect(200);

      assertRequestId(res);
      assert.deepStrictEqual(res.body.data, { accepted: 3, total: 2 });
      assert.deepStrictEqual(Array.from(app.pageVisitStore.keys()).sort(), [ 'b', 'c' ]);
    });

    it('rejects invalid tabIds without mutating the store', async () => {
      seedVisit('keep', '2024-01-01T00:00:00.000Z');
      const before = visitSnapshot(app.pageVisitStore);

      const invalidBodies = [
        {},
        { tabIds: null },
        { tabIds: 'a' },
        { tabIds: [] },
        { tabIds: Array.from({ length: 51 }, (_v, i) => `tab-${i}`) },
        { tabIds: [ 1 ] },
        { tabIds: [ '  ' ] },
      ];

      for (const body of invalidBodies) {
        const res = await app.httpRequest()
          .post('/api/visit-admin/touch')
          .send(body)
          .expect(400);
        assertRequestId(res);
        assert(typeof res.body.message === 'string' && res.body.message.length > 0);
        assert.deepStrictEqual(visitSnapshot(app.pageVisitStore), before);
      }

      delete app.pageVisitStore;
      const res = await app.httpRequest()
        .post('/api/visit-admin/touch')
        .send({ tabIds: [] })
        .expect(400);
      assertRequestId(res);
      assert(!app.pageVisitStore || app.pageVisitStore.size === 0);
      assert(!(app.pageVisitStore instanceof Map && app.pageVisitStore.size === 0));
    });

    it('echoes a valid x-request-id header', async () => {
      await app.httpRequest()
        .post('/api/visit-admin/touch')
        .set('x-request-id', 'touchReq_01')
        .send({ tabIds: [ 'a' ] })
        .expect(200)
        .expect('x-request-id', 'touchReq_01');

      assert.strictEqual(app.pageVisitStore.get('a').requestId, 'touchReq_01');
    });
  });

  describe('integration with legacy page-visit API', () => {
    it('legacy open still works and clear only clears page visits', async () => {
      await app.httpRequest()
        .post('/api/page-visit')
        .send({ tabId: 'legacy' })
        .expect(200);

      const list = await app.httpRequest()
        .get('/api/page-visit')
        .expect(200);
      assert(list.body.data.some(item => item.tabId === 'legacy'));

      await app.httpRequest()
        .post('/api/visit-admin/clear')
        .send({})
        .expect(200);

      const after = await app.httpRequest()
        .get('/api/page-visit')
        .expect(200);
      assert.strictEqual(after.body.total, 0);
    });
  });

  describe('api-debug endpoints presets', () => {
    it('keeps legacy endpoint ids and merges visit-admin presets', () => {
      const endpointsText = fs.readFileSync(ENDPOINTS_JS, 'utf8');
      assert(endpointsText.includes("from './endpoints/visitAdminClear.js'"));
      assert(endpointsText.includes("from './endpoints/visitAdminPrune.js'"));
      assert(endpointsText.includes("from './endpoints/visitAdminTouch.js'"));

      const idMatches = [ ...endpointsText.matchAll(/id:\s*'([^']+)'/g) ].map(m => m[1]);
      const legacyInFile = idMatches.slice(0, LEGACY_ENDPOINT_IDS.length);
      assert.deepStrictEqual(legacyInFile, LEGACY_ENDPOINT_IDS);

      const presetSpecs = [
        {
          file: 'visitAdminClear.js',
          id: 'visit-admin-clear',
          path: '/api/visit-admin/clear',
        },
        {
          file: 'visitAdminPrune.js',
          id: 'visit-admin-prune',
          path: '/api/visit-admin/prune',
        },
        {
          file: 'visitAdminTouch.js',
          id: 'visit-admin-touch',
          path: '/api/visit-admin/touch',
        },
      ];

      const presetIds = [];
      for (const spec of presetSpecs) {
        const text = fs.readFileSync(
          path.join(ROOT, 'app/public/assets/js/api-debug/endpoints', spec.file),
          'utf8'
        );
        assert(text.includes(`id: '${spec.id}'`));
        assert(text.includes("group: '访问维护'"));
        assert(text.includes("method: 'POST'"));
        assert(text.includes(`path: '${spec.path}'`));
        presetIds.push(spec.id);
      }

      const combined = [ ...legacyInFile, ...presetIds ];
      assert.strictEqual(new Set(combined).size, combined.length);
    });
  });
});
