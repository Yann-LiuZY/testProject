'use strict';

const assert = require('assert');
const mm = require('egg-mock');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

describe('test/app/middleware/requestId.test.js', () => {
  let app;

  before(() => {
    app = mm.app();
    return app.ready();
  });

  after(() => app.close());
  afterEach(mm.restore);

  it('should reuse a valid x-request-id', async () => {
    const requestId = 'abcDEF_123-456';
    const res = await app.httpRequest()
      .get('/test')
      .set('x-request-id', requestId)
      .expect(200)
      .expect('x-request-id', requestId);

    assert.deepStrictEqual(res.body, { data: 'test' });
  });

  it('should replace an invalid x-request-id', async () => {
    const res = await app.httpRequest()
      .get('/test')
      .set('x-request-id', 'not valid!')
      .expect(200);

    const requestId = res.headers['x-request-id'];
    assert(REQUEST_ID_PATTERN.test(requestId));
    assert.notStrictEqual(requestId, 'not valid!');
    assert.deepStrictEqual(res.body, { data: 'test' });
  });

  it('should generate different ids for consecutive requests', async () => {
    const first = await app.httpRequest().get('/test').expect(200);
    const second = await app.httpRequest().get('/test').expect(200);

    const firstId = first.headers['x-request-id'];
    const secondId = second.headers['x-request-id'];

    assert(REQUEST_ID_PATTERN.test(firstId));
    assert(REQUEST_ID_PATTERN.test(secondId));
    assert.notStrictEqual(firstId, secondId);
  });

  it('should keep other endpoint responses unchanged', async () => {
    const res = await app.httpRequest()
      .get('/api/debug-config')
      .expect(404);

    assert.deepStrictEqual(res.body, { message: 'debug config is empty' });
  });

  it('should include requestId in the page-visit record and log', async () => {
    const requestId = 'pageVisit_123';
    let logged;
    mm(app.getLogger('pageVisitLogger'), 'info', message => {
      logged = JSON.parse(message);
    });

    const res = await app.httpRequest()
      .post('/api/page-visit')
      .set('x-request-id', requestId)
      .send({ tabId: 'request-id-test-tab' })
      .expect(200)
      .expect('x-request-id', requestId);

    assert.strictEqual(res.body.data.requestId, requestId);
    assert(logged, 'page-visit log should be written');
    assert.strictEqual(logged.requestId, requestId);
  });
});
