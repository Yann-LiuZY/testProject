import { dom, state, setError } from './state.js';
import { methodHasBody, copyWithFeedback } from './utils.js';
import { renderResponse } from './response.js';
import { addHistory } from './history.js';

function resolvePath(raw) {
  const value = raw.trim();
  if (!value) throw new Error('请填写路径');
  let url;
  try {
    url = new URL(value, location.origin);
  } catch (err) {
    throw new Error('路径格式不正确');
  }
  if (url.origin !== location.origin) throw new Error('只能请求当前服务');
  return url.pathname + url.search + url.hash;
}

function parseHeaders() {
  const raw = dom.headersEl.value.trim();
  if (!raw) return {};
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error('请求头不是合法 JSON');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('请求头必须是 JSON 对象');
  }
  const headers = {};
  Object.entries(parsed).forEach(([ key, value ]) => {
    if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
      throw new Error('请求头 ' + key + ' 的值必须是字符串、数字或布尔值');
    }
    headers[key] = String(value);
  });
  return headers;
}

function readRequest() {
  const path = resolvePath(dom.pathEl.value);
  const method = dom.methodEl.value;
  const headers = parseHeaders();
  let payload;
  if (methodHasBody(method)) {
    const raw = dom.bodyEl.value.trim();
    if (raw) {
      try {
        payload = JSON.stringify(JSON.parse(raw));
      } catch (err) {
        throw new Error('请求体不是合法 JSON');
      }
      const hasContentType = Object.keys(headers)
        .some(key => key.toLowerCase() === 'content-type');
      if (!hasContentType) {
        headers['Content-Type'] = 'application/json';
      }
    }
  }
  return { method, path, headers, payload };
}

function shellQuote(value) {
  return "'" + String(value).replace(/'/g, "'\\''") + "'";
}

function buildCurl(request) {
  const url = new URL(request.path, location.origin).href;
  const parts = [ 'curl' ];
  if (request.method !== 'GET') parts.push('-X ' + request.method);
  Object.entries(request.headers).forEach(([ key, value ]) => {
    parts.push('-H ' + shellQuote(key + ': ' + value));
  });
  if (request.payload) parts.push('--data-raw ' + shellQuote(request.payload));
  parts.push(shellQuote(url));
  return parts.join(' \\\n  ');
}

export async function copyCurl() {
  setError('');
  let request;
  try {
    request = readRequest();
  } catch (err) {
    setError(err.message);
    return;
  }
  const curl = buildCurl(request);
  await copyWithFeedback(dom.curlEl, curl, [ '已复制 cURL', '复制失败', '复制 cURL' ]);
}

export async function send() {
  setError('');
  let request;
  try {
    request = readRequest();
  } catch (err) {
    setError(err.message);
    return;
  }
  const { method, path, headers, payload } = request;

  if (state.inflight) state.inflight.abort();
  const controller = new AbortController();
  state.inflight = controller;
  dom.sendEl.disabled = true;
  dom.sendEl.textContent = '发送中…';
  const started = performance.now();

  try {
    const response = await fetch(path, {
      method,
      headers,
      body: payload,
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    const ms = Math.round(performance.now() - started);
    let pretty = text;
    if (text) {
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch (err) {
        pretty = text;
      }
    }
    state.responseText = pretty;
    const requestId = response.headers.get('x-request-id') || '';
    renderResponse({
      status: response.status,
      method,
      path,
      ms,
      bytes: new Blob([ text ]).size,
      pretty,
      requestId,
      headers: Array.from(response.headers.entries()),
    });
    addHistory({
      at: new Date().toLocaleTimeString('zh-CN', { hour12: false }),
      method,
      path,
      headers: dom.headersEl.value.trim(),
      body: methodHasBody(method) ? dom.bodyEl.value : '',
      status: response.status,
      requestId,
    });
  } catch (err) {
    if (err.name === 'AbortError') return;
    dom.responseEl.replaceChildren();
    const message = document.createElement('p');
    message.className = 'form-error';
    message.textContent = '请求失败：' + err.message;
    dom.responseEl.append(message);
  } finally {
    if (state.inflight === controller) {
      state.inflight = null;
      dom.sendEl.disabled = false;
      dom.sendEl.textContent = '发送';
    }
  }
}

function formatJsonField(element, label) {
  const raw = element.value.trim();
  if (!raw) return true;
  try {
    element.value = JSON.stringify(JSON.parse(raw), null, 2);
    return true;
  } catch (err) {
    setError(label + '不是合法 JSON');
    return false;
  }
}

export function formatBody() {
  setError('');
  let ok = true;
  if (!dom.bodyField.hidden) {
    ok = formatJsonField(dom.bodyEl, '请求体') && ok;
  }
  ok = formatJsonField(dom.headersEl, '请求头') && ok;
  if (ok) setError('');
}
