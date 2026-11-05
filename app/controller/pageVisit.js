const { Controller } = require('egg');

/**
 * 内存中保存最近打开的页面记录，条数不超过 pageVisit.maxTabs，进程重启后清空；
 * 同时会写入 logs/<app>/page-visit.log，便于持久排查。
 * @param {Egg.Application} app - egg application
 * @return {Map<string, object>} store
 */
function getStore(app) {
  if (!app.pageVisitStore) {
    app.pageVisitStore = new Map();
  }
  return app.pageVisitStore;
}

/**
 * 每次请求从 app.config 读取上限，测试会临时改小这个值。
 * @param {Egg.Application} app - egg application
 * @return {number} max tabs kept in memory
 */
function getMaxTabs(app) {
  const configured = app.config.pageVisit && app.config.pageVisit.maxTabs;
  if (typeof configured === 'number' && Number.isFinite(configured) && configured >= 0) {
    return configured;
  }
  return 100;
}

/**
 * 重复打开时把记录挪到末尾，使 Map 顺序与最近打开顺序一致。
 * @param {Map<string, object>} store - page visit store
 * @param {string} tabId - tab id
 * @param {object} record - visit record
 */
function touchRecord(store, tabId, record) {
  if (store.has(tabId)) {
    store.delete(tabId);
  }
  store.set(tabId, record);
}

/**
 * 超过上限时淘汰最久没有被打开过的记录。
 * lastOpenedAt 相同则淘汰更早写入的那条；本次刚打开的 tab 不淘汰。
 * @param {Map<string, object>} store - page visit store
 * @param {number} maxTabs - capacity
 * @param {string} currentTabId - tab opened by this request
 */
function evictLeastRecentlyOpened(store, maxTabs, currentTabId) {
  while (store.size > maxTabs) {
    let oldestId;
    let oldestAt;
    for (const [ id, record ] of store) {
      if (id === currentTabId) {
        continue;
      }
      if (oldestAt === undefined || record.lastOpenedAt < oldestAt) {
        oldestAt = record.lastOpenedAt;
        oldestId = id;
      }
    }
    if (oldestId === undefined) {
      break;
    }
    store.delete(oldestId);
  }
}

function normalizeTabId(raw) {
  return typeof raw === 'string' ? raw.trim() : '';
}

class PageVisitController extends Controller {
  /**
   * 记录页面被打开，参数 tabId: string
   * POST /api/page-visit
   */
  async open() {
    const { ctx, app } = this;
    const body = ctx.request.body || {};
    const raw = body.tabId === undefined ? ctx.query.tabId : body.tabId;
    const tabId = normalizeTabId(raw);
    if (!tabId) {
      ctx.status = 400;
      ctx.body = { message: 'tabId is required and must be a non-empty string' };
      return;
    }

    const store = getStore(app);
    const maxTabs = getMaxTabs(app);
    const now = new Date().toISOString();
    const previous = store.get(tabId);
    const record = {
      tabId,
      requestId: ctx.requestId,
      openedAt: previous ? previous.openedAt : now,
      lastOpenedAt: now,
      openCount: previous ? previous.openCount + 1 : 1,
    };
    touchRecord(store, tabId, record);
    evictLeastRecentlyOpened(store, maxTabs, tabId);

    app.getLogger('pageVisitLogger').info(JSON.stringify({
      ...record,
      ip: ctx.ip,
      userAgent: ctx.get('user-agent'),
    }));

    ctx.body = { data: record };
  }

  /**
   * 查询已记录的页面打开情况
   * GET /api/page-visit
   */
  async show() {
    const { ctx, app } = this;
    const list = Array.from(getStore(app).values())
      .sort((a, b) => b.lastOpenedAt.localeCompare(a.lastOpenedAt));
    ctx.body = { data: list, total: list.length };
  }
}

module.exports = PageVisitController;
