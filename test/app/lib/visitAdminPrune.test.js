'use strict';

const assert = require('assert');
const { prunePageVisits } = require('../../../app/lib/visitAdminPrune');

function makeStore() {
  return new Map([
    [ 'tab-1', { tabId: 'tab-1', lastOpenedAt: '2024-01-01T00:00:00.000Z' }],
    [ 'tab-2', { tabId: 'tab-2', lastOpenedAt: '2024-01-02T00:00:00.000Z' }],
    [ 'tab-3', { tabId: 'tab-3', lastOpenedAt: '2024-01-03T00:00:00.000Z' }],
  ]);
}

function snapshot(store) {
  return Array.from(store.entries()).map(([ id, record ]) => [ id, { ...record }]);
}

describe('prunePageVisits', () => {
  it('evicts the record with the smallest lastOpenedAt', () => {
    const store = makeStore();
    const originalStore = store;

    const result = prunePageVisits(store, 2);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.removed, 1);
    assert.strictEqual(result.remaining, 2);
    assert.strictEqual(store.size, 2);
    assert.strictEqual(store, originalStore);
    assert.strictEqual(store.has('tab-1'), false);
    assert.strictEqual(store.has('tab-2'), true);
    assert.strictEqual(store.has('tab-3'), true);
  });

  it('evicts the earlier-written record first when lastOpenedAt ties', () => {
    const store = new Map([
      [ 'tab-a', { tabId: 'tab-a', lastOpenedAt: '2024-01-01T00:00:00.000Z' }],
      [ 'tab-b', { tabId: 'tab-b', lastOpenedAt: '2024-01-01T00:00:00.000Z' }],
      [ 'tab-c', { tabId: 'tab-c', lastOpenedAt: '2024-01-02T00:00:00.000Z' }],
    ]);

    const result = prunePageVisits(store, 1);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.removed, 2);
    assert.strictEqual(result.remaining, 1);
    assert.strictEqual(store.has('tab-a'), false);
    assert.strictEqual(store.has('tab-b'), false);
    assert.strictEqual(store.has('tab-c'), true);
  });

  it('leaves records unchanged and returns removed 0 when already within limit', () => {
    const store = makeStore();
    const before = snapshot(store);

    const result = prunePageVisits(store, 1000);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.removed, 0);
    assert.strictEqual(result.remaining, 3);
    assert.deepStrictEqual(snapshot(store), before);
  });

  it('deletes every record when maxTabs is 0', () => {
    const store = makeStore();

    const result = prunePageVisits(store, 0);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.removed, 3);
    assert.strictEqual(result.remaining, 0);
    assert.strictEqual(store.size, 0);
  });

  it('treats null and undefined stores as empty', () => {
    assert.deepStrictEqual(prunePageVisits(null, 10), { ok: true, removed: 0, remaining: 0 });
    assert.deepStrictEqual(prunePageVisits(undefined, 10), { ok: true, removed: 0, remaining: 0 });
  });

  it('rejects invalid maxTabs values without touching the store', () => {
    const invalidValues = [ undefined, null, '10', 1.5, -1, 1001, NaN, Infinity, true ];

    for (const maxTabs of invalidValues) {
      const store = makeStore();
      const before = snapshot(store);

      const result = prunePageVisits(store, maxTabs);

      assert.strictEqual(result.ok, false, 'expected ok false for ' + String(maxTabs));
      assert.strictEqual(result.message, 'maxTabs must be an integer between 0 and 1000');
      assert.deepStrictEqual(snapshot(store), before);
    }
  });

  it('accepts integer-valued numbers like 1.0', () => {
    const store = makeStore();

    const result = prunePageVisits(store, 1.0);

    assert.strictEqual(result.ok, true);
    assert.strictEqual(result.removed, 2);
    assert.strictEqual(result.remaining, 1);
    assert.strictEqual(store.has('tab-3'), true);
  });
});
