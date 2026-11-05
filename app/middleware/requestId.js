'use strict';

const { randomUUID } = require('crypto');

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/**
 * 为每次请求确定一个 requestId：
 * 合法（^[A-Za-z0-9_-]{8,64}$）的 x-request-id 透传，否则生成新的 uuid。
 * 非法值不会原样写入响应头，避免请求头伪造日志/响应内容。
 * @return {Function} egg middleware
 */
module.exports = () => {
  return async function requestId(ctx, next) {
    const incoming = ctx.get('x-request-id');
    const requestId = typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
      ? incoming
      : randomUUID();

    ctx.requestId = requestId;
    ctx.set('x-request-id', requestId);

    await next();
  };
};
