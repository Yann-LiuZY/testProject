const { Controller } = require('egg');

/**
 * 内存中保存最近打开的页面记录，进程重启后清空；
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
    const now = new Date().toISOString();
    const previous = store.get(tabId);
    const record = {
      tabId,
      openedAt: previous ? previous.openedAt : now,
      lastOpenedAt: now,
      openCount: previous ? previous.openCount + 1 : 1,
    };
    store.set(tabId, record);

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
