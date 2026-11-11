const { Controller } = require('egg');
const { clearPageVisits } = require('../lib/visitAdminClear');

class VisitAdminClearController extends Controller {
  async clear() {
    const { ctx, app } = this;
    const result = clearPageVisits(app.pageVisitStore);
    ctx.status = 200;
    ctx.body = { data: result };
  }
}

module.exports = VisitAdminClearController;
