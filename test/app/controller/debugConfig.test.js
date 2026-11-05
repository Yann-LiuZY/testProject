'use strict';

const assert = require('assert');
const mm = require('egg-mock');

describe('test/app/controller/debugConfig.test.js', () => {
  let app;

  before(() => {
    app = mm.app();
    return app.ready();
  });

  after(() => app.close());

  beforeEach(() => {
    return app.httpRequest()
      .delete('/api/debug-config')
      .expect(204);
  });

  afterEach(mm.restore);

  it('should return 404 when config is empty', async () => {
    const res = await app.httpRequest()
      .get('/api/debug-config')
      .expect(404);

    assert.deepStrictEqual(res.body, { message: 'debug config is empty' });
  });

  it('should create config without version and bump version for legacy clients', async () => {
    const first = await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: { enabled: true } })
      .expect(200);

    assert.deepStrictEqual(first.body, { data: { enabled: true }, version: 1 });

    const second = await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'replaced without version' })
      .expect(200);

    assert.deepStrictEqual(second.body, { data: 'replaced without version', version: 2 });
  });

  it('should return data and version from GET', async () => {
    await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: [ 1, 2, 3 ] })
      .expect(200);

    const res = await app.httpRequest()
      .get('/api/debug-config')
      .expect(200);

    assert.deepStrictEqual(res.body, { data: [ 1, 2, 3 ], version: 1 });
  });

  it('should write and bump version when version matches', async () => {
    await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'first' })
      .expect(200);

    const res = await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'second', version: 1 })
      .expect(200);

    assert.deepStrictEqual(res.body, { data: 'second', version: 2 });

    const current = await app.httpRequest()
      .get('/api/debug-config')
      .expect(200);

    assert.deepStrictEqual(current.body, { data: 'second', version: 2 });
  });

  it('should return 409 and keep existing data when version is stale', async () => {
    await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'current' })
      .expect(200);

    const conflict = await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'stale overwrite', version: 0 })
      .expect(409);

    assert.strictEqual(conflict.body.currentVersion, 1);

    const current = await app.httpRequest()
      .get('/api/debug-config')
      .expect(200);

    assert.deepStrictEqual(current.body, { data: 'current', version: 1 });
  });

  it('should report the latest currentVersion on conflict', async () => {
    await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'one' })
      .expect(200);

    await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'two', version: 1 })
      .expect(200);

    const conflict = await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'three', version: 1 })
      .expect(409);

    assert.strictEqual(conflict.body.currentVersion, 2);
  });

  it('should reset version to 0 after DELETE', async () => {
    await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'before delete' })
      .expect(200);

    await app.httpRequest()
      .delete('/api/debug-config')
      .expect(204);

    await app.httpRequest()
      .get('/api/debug-config')
      .expect(404);

    const res = await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'after delete' })
      .expect(200);

    assert.deepStrictEqual(res.body, { data: 'after delete', version: 1 });
  });

  it('should keep consume response shape and reset version', async () => {
    await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: { token: 'one-shot' } })
      .expect(200);

    const consumed = await app.httpRequest()
      .get('/api/debug-config/consume')
      .expect(200);

    assert.deepStrictEqual(consumed.body, { data: { token: 'one-shot' } });

    await app.httpRequest()
      .get('/api/debug-config')
      .expect(404);

    const next = await app.httpRequest()
      .post('/api/debug-config')
      .send({ data: 'after consume' })
      .expect(200);

    assert.deepStrictEqual(next.body, { data: 'after consume', version: 1 });
  });
});
