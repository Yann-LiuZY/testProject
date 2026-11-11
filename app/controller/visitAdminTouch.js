const { Controller } = require('egg');
const { parseTouchTabIds, resolveMaxTabs, touchPageVisits } = require('../lib/visitAdminTouch');

class VisitAdminTouchController extends Controller {
  async touch() {
    const { ctx, app } = this;
    const body = ctx.request.body;
    const rawTabIds = body && typeof body === 'object' && !Array.isArray(body) ? body.tabIds : undefined;
    const parsed = parseTouchTabIds(rawTabIds);
    if (!parsed.ok) {
      ctx.status = 400;
      ctx.body = { message: parsed.message };
      return;
    }
    if (!app.pageVisitStore) {
      app.pageVisitStore = new Map();
    }
    const configured = app.config.pageVisit && app.config.pageVisit.maxTabs;
    const result = touchPageVisits(app.pageVisitStore, parsed.tabIds, {
      now: new Date().toISOString(),
      requestId: ctx.requestId,
      maxTabs: resolveMaxTabs(configured),
    });
    ctx.status = 200;
    ctx.body = { data: result };
  }
}

module.exports = VisitAdminTouchController;
