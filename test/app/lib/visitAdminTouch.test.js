'use strict';

const assert = require('assert');
const { parseTouchTabIds, resolveMaxTabs, touchPageVisits } = require('../../../app/lib/visitAdminTouch');

const INVALID_TAB_IDS_MESSAGE = 'tabIds must be an array of 1 to 50 non-empty strings';

function assertInvalidTabIds(value) {
  assert.deepStrictEqual(parseTouchTabIds(value), {
    ok: false,
    message: INVALID_TAB_IDS_MESSAGE,
  });
}

describe('parseTouchTabIds', () => {
  it('accepts a single non-empty string', () => {
    assert.deepStrictEqual(parseTouchTabIds([ 'tab-1' ]), {
      ok: true,
      tabIds: [ 'tab-1' ],
    });
  });

  it('accepts 50 items', () => {
    const tabIds = [];
    for (let i = 0; i < 50; i++) {
      tabIds.push('tab-' + i);
    }
    const parsed = parseTouchTabIds(tabIds);
    assert.strictEqual(parsed.ok, true);
    assert.strictEqual(parsed.tabIds.length, 50);
    assert.deepStrictEqual(parsed.tabIds, tabIds);
  });

  it('trims each item and keeps order', () => {
    assert.deepStrictEqual(parseTouchTabIds([ '  a  ', ' b', 'c ' ]), {
      ok: true,
      tabIds: [ 'a', 'b', 'c' ],
    });
  });

  it('keeps duplicate items', () => {
    assert.deepStrictEqual(parseTouchTabIds([ 'a', 'a' ]), {
      ok: true,
      tabIds: [ 'a', 'a' ],
    });
  });

  it('rejects undefined', () => {
    assertInvalidTabIds(undefined);
  });

  it('rejects null', () => {
    assertInvalidTabIds(null);
  });

  it('rejects a string', () => {
    assertInvalidTabIds('tab-1');
  });

  it('rejects an empty array', () => {
    assertInvalidTabIds([]);
  });

  it('rejects 51 items', () => {
    const tabIds = [];
    for (let i = 0; i < 51; i++) {
      tabIds.push('tab-' + i);
    }
    assertInvalidTabIds(tabIds);
  });

  it('rejects a non-string item', () => {
    assertInvalidTabIds([ 1 ]);
    assertInvalidTabIds([ 'ok', { tabId: 'x' }]);
  });

  it('rejects an empty string', () => {
    assertInvalidTabIds([ '' ]);
  });

  it('rejects a whitespace string', () => {
    assertInvalidTabIds([ '   ' ]);
  });

  it('does not mutate a prepared Map when input is invalid', () => {
    const store = new Map([
      [ 'tab-1', { tabId: 'tab-1', openCount: 1 }],
    ]);
    const snapshot = Array.from(store.entries());

    assertInvalidTabIds(undefined);
    assertInvalidTabIds(null);
    assertInvalidTabIds('tab-1');
    assertInvalidTabIds([]);
    assertInvalidTabIds([ '' ]);
    assertInvalidTabIds([ '   ' ]);

    assert.deepStrictEqual(Array.from(store.entries()), snapshot);
    assert.strictEqual(store.size, 1);
  });
});

describe('resolveMaxTabs', () => {
  it('returns 0, 1.5 and 100 as-is', () => {
    assert.strictEqual(resolveMaxTabs(0), 0);
    assert.strictEqual(resolveMaxTabs(1.5), 1.5);
    assert.strictEqual(resolveMaxTabs(100), 100);
  });

  it('falls back to 100 for non-finite or negative values', () => {
    assert.strictEqual(resolveMaxTabs(undefined), 100);
    assert.strictEqual(resolveMaxTabs(null), 100);
    assert.strictEqual(resolveMaxTabs('100'), 100);
    assert.strictEqual(resolveMaxTabs(-1), 100);
    assert.strictEqual(resolveMaxTabs(NaN), 100);
    assert.strictEqual(resolveMaxTabs(Infinity), 100);
  });
});

describe('touchPageVisits', () => {
  it('creates a new record with the expected fields', () => {
    const store = new Map();
    const now = '2026-01-01T00:00:00.000Z';
    const result = touchPageVisits(store, [ 'tab-1' ], {
      now,
      requestId: 'req-1',
      maxTabs: 100,
    });

    assert.deepStrictEqual(result, { accepted: 1, total: 1 });
    assert.deepStrictEqual(store.get('tab-1'), {
      tabId: 'tab-1',
      requestId: 'req-1',
      openedAt: now,
      lastOpenedAt: now,
      openCount: 1,
    });
  });

  it('keeps openedAt and updates lastOpenedAt, requestId and openCount', () => {
    const openedAt = '2020-01-01T00:00:00.000Z';
    const store = new Map();
    store.set('tab-1', {
      tabId: 'tab-1',
      requestId: 'req-old',
      openedAt,
      lastOpenedAt: openedAt,
      openCount: 4,
    });
    const now = '2026-01-01T00:00:00.000Z';

    touchPageVisits(store, [ 'tab-1' ], {
      now,
      requestId: 'req-new',
      maxTabs: 100,
    });

    assert.deepStrictEqual(store.get('tab-1'), {
      tabId: 'tab-1',
      requestId: 'req-new',
      openedAt,
      lastOpenedAt: now,
      openCount: 5,
    });
  });

  it('accumulates openCount for duplicate tab ids in one batch', () => {
    const store = new Map();
    store.set('a', {
      tabId: 'a',
      requestId: 'req-old',
      openedAt: '2020-01-01T00:00:00.000Z',
      lastOpenedAt: '2020-01-01T00:00:00.000Z',
      openCount: 1,
    });

    const result = touchPageVisits(store, [ 'a', 'a' ], {
      now: '2026-01-01T00:00:00.000Z',
      requestId: 'req-2',
      maxTabs: 100,
    });

    assert.strictEqual(result.accepted, 2);
    assert.strictEqual(result.total, 1);
    assert.strictEqual(store.get('a').openCount, 3);
  });

  it('uses the same now for the whole batch', () => {
    const store = new Map();
    const now = '2026-01-01T00:00:00.000Z';

    touchPageVisits(store, [ 'a', 'b' ], {
      now,
      requestId: 'req-1',
      maxTabs: 100,
    });

    assert.strictEqual(store.get('a').openedAt, now);
    assert.strictEqual(store.get('a').lastOpenedAt, now);
    assert.strictEqual(store.get('b').openedAt, now);
    assert.strictEqual(store.get('b').lastOpenedAt, now);
  });

  it('evicts the earliest written tab when timestamps are equal', () => {
    const store = new Map();
    const now = '2026-01-01T00:00:00.000Z';
    const result = touchPageVisits(store, [ 'a', 'b', 'c' ], {
      now,
      requestId: 'req-1',
      maxTabs: 2,
    });

    assert.strictEqual(result.accepted, 3);
    assert.strictEqual(result.total, 2);
    assert.deepStrictEqual(Array.from(store.keys()), [ 'b', 'c' ]);
  });

  it('moves a reopened tab to the most recent and keeps it when evicting', () => {
    const t1 = '2026-01-01T00:00:00.000Z';
    const store = new Map();
    store.set('a', {
      tabId: 'a',
      requestId: 'req-1',
      openedAt: t1,
      lastOpenedAt: t1,
      openCount: 1,
    });
    store.set('b', {
      tabId: 'b',
      requestId: 'req-1',
      openedAt: t1,
      lastOpenedAt: t1,
      openCount: 1,
    });
    const now = '2026-01-02T00:00:00.000Z';

    const result = touchPageVisits(store, [ 'a', 'c' ], {
      now,
      requestId: 'req-2',
      maxTabs: 2,
    });

    assert.strictEqual(result.accepted, 2);
    assert.strictEqual(result.total, 2);
    assert.deepStrictEqual(Array.from(store.keys()), [ 'a', 'c' ]);
    assert.strictEqual(store.get('a').openCount, 2);
  });
});
