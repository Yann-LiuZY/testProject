const { Controller } = require('egg');

function getStore(app) {
  if (!app.debugConfigStore) {
    app.debugConfigStore = { hasData: false, data: undefined };
  }
  return app.debugConfigStore;
}

class DebugConfigController extends Controller {
  async show() {
    const { ctx, app } = this;
    const store = getStore(app);
    if (!store.hasData) {
      ctx.status = 404;
      ctx.body = { message: 'debug config is empty' };
      return;
    }
    ctx.body = { data: store.data };
  }

  async create() {
    const { ctx, app } = this;
    const store = getStore(app);
    const data = ctx.request.body && Object.prototype.hasOwnProperty.call(ctx.request.body, 'data')
      ? ctx.request.body.data
      : ctx.query.data;
    store.hasData = true;
    store.data = data;
    ctx.body = { data: store.data };
  }

  async destroy() {
    const { ctx, app } = this;
    const store = getStore(app);
    store.hasData = false;
    store.data = undefined;
    ctx.status = 204;
  }

  async consume() {
    const { ctx, app } = this;
    const store = getStore(app);
    if (!store.hasData) {
      ctx.status = 404;
      ctx.body = { message: 'debug config is empty' };
      return;
    }
    const data = store.data;
    store.hasData = false;
    store.data = undefined;
    ctx.body = { data };
  }
}

module.exports = DebugConfigController;
