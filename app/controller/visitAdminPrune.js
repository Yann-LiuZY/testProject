const { Controller } = require('egg');
const { prunePageVisits } = require('../lib/visitAdminPrune');

class VisitAdminPruneController extends Controller {
  async prune() {
    const { ctx, app } = this;
    const body = ctx.request.body;
    const maxTabs = body && typeof body === 'object' && !Array.isArray(body) ? body.maxTabs : undefined;
    const result = prunePageVisits(app.pageVisitStore, maxTabs);
    if (!result.ok) {
      ctx.status = 400;
      ctx.body = { message: result.message };
      return;
    }
    ctx.status = 200;
    ctx.body = { data: { removed: result.removed, remaining: result.remaining } };
  }
}

module.exports = VisitAdminPruneController;
