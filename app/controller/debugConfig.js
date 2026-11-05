const { Controller } = require('egg');

function getStore(app) {
  if (!app.debugConfigStore) {
    app.debugConfigStore = { hasData: false, data: undefined, version: 0 };
  }
  return app.debugConfigStore;
}

function hasOwn(object, key) {
  return object != null && Object.prototype.hasOwnProperty.call(object, key);
}

function parseVersion(value) {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= 0 ? value : NaN;
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return Number(value);
  }
  return NaN;
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
    ctx.body = { data: store.data, version: store.version };
  }

  async create() {
    const { ctx, app } = this;
    const store = getStore(app);
    const body = ctx.request.body;
    const data = hasOwn(body, 'data') ? body.data : ctx.query.data;

    if (hasOwn(body, 'version')) {
      const expectedVersion = parseVersion(body.version);
      if (!Number.isFinite(expectedVersion) || expectedVersion !== store.version) {
        ctx.status = 409;
        ctx.body = {
          message: 'debug config version conflict',
          currentVersion: store.version,
        };
        return;
      }
    }

    store.hasData = true;
    store.data = data;
    store.version += 1;
    ctx.body = { data: store.data, version: store.version };
  }

  async destroy() {
    const { ctx, app } = this;
    const store = getStore(app);
    store.hasData = false;
    store.data = undefined;
    store.version = 0;
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
    store.version = 0;
    ctx.body = { data };
  }
}

module.exports = DebugConfigController;
