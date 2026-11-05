'use strict';

const { app, assert } = require('egg-mock/bootstrap');

async function openTab(tabId) {
  return app.httpRequest()
    .post('/api/page-visit')
    .send({ tabId })
    .expect(200);
}

async function listVisits() {
  return app.httpRequest()
    .get('/api/page-visit')
    .expect(200);
}

function tabIds(res) {
  return res.body.data.map(item => item.tabId).sort();
}

describe('test/app/controller/pageVisit.test.js', () => {
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

  it('上限内不淘汰', async () => {
    app.config.pageVisit.maxTabs = 3;
    await openTab('a');
    await openTab('b');
    await openTab('c');

    const res = await listVisits();
    assert.deepStrictEqual(tabIds(res), [ 'a', 'b', 'c' ]);
    assert(res.body.total === 3);
  });

  it('超限淘汰最久未访问', async () => {
    app.config.pageVisit.maxTabs = 2;
    await openTab('a');
    await openTab('b');
    await openTab('c');

    const res = await listVisits();
    assert.deepStrictEqual(tabIds(res), [ 'b', 'c' ]);
    assert(res.body.total === 2);
  });

  it('重复打开刷新顺序', async () => {
    app.config.pageVisit.maxTabs = 2;
    await openTab('a');
    await openTab('b');
    const refreshed = await openTab('a');
    await openTab('c');

    assert(refreshed.body.data.openCount === 2);
    const res = await listVisits();
    assert.deepStrictEqual(tabIds(res), [ 'a', 'c' ]);
    assert(res.body.total === 2);
    const tabA = res.body.data.find(item => item.tabId === 'a');
    assert(tabA.openCount === 2);
  });

  it('淘汰后重开计数重置', async () => {
    app.config.pageVisit.maxTabs = 1;
    await openTab('a');
    const again = await openTab('a');
    assert(again.body.data.openCount === 2);

    await openTab('b');
    const afterEvict = await listVisits();
    assert(afterEvict.body.total === 1);
    assert(afterEvict.body.data[0].tabId === 'b');

    const reopened = await openTab('a');
    assert(reopened.body.data.openCount === 1);
    assert(reopened.body.data.openedAt === reopened.body.data.lastOpenedAt);

    const res = await listVisits();
    assert(res.body.total === 1);
    assert(res.body.data[0].tabId === 'a');
    assert(res.body.data[0].openCount === 1);
  });
});
