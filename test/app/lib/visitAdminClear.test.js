'use strict';

const assert = require('assert');
const { clearPageVisits } = require('../../../app/lib/visitAdminClear');

describe('clearPageVisits', () => {
  it('clears records in place and returns the removed count', () => {
    const store = new Map([
      [ 'tab-1', { tabId: 'tab-1' }],
      [ 'tab-2', { tabId: 'tab-2' }],
    ]);
    const originalStore = store;

    const result = clearPageVisits(store);

    assert.strictEqual(result.removed, 2);
    assert.strictEqual(result.remaining, 0);
    assert.strictEqual(store.size, 0);
    assert.strictEqual(store, originalStore);
  });

  it('returns zero when the store is empty', () => {
    const result = clearPageVisits(new Map());

    assert.deepStrictEqual(result, { removed: 0, remaining: 0 });
  });

  it('treats null and undefined as empty stores', () => {
    assert.deepStrictEqual(clearPageVisits(null), { removed: 0, remaining: 0 });
    assert.deepStrictEqual(clearPageVisits(undefined), { removed: 0, remaining: 0 });
  });

  it('does not affect independent objects', () => {
    const store = new Map([[ 'tab-1', { tabId: 'tab-1' }]]);
    const debugConfigStore = { hasData: true, data: { enabled: true }, version: 1 };

    clearPageVisits(store);

    assert.deepStrictEqual(debugConfigStore, {
      hasData: true,
      data: { enabled: true },
      version: 1,
    });
  });
});
