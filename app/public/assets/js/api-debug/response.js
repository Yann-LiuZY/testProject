import { dom, state } from './state.js';
import { copyWithFeedback, formatBytes } from './utils.js';

function statusKind(status) {
  if (status >= 200 && status < 300) return 'ok';
  if (status >= 400 && status < 500) return 'warn';
  return 'err';
}

export function renderResponse(result) {
  dom.responseEl.replaceChildren();
  const head = document.createElement('div');
  head.className = 'response-head';
  const status = document.createElement('span');
  status.className = 'status status-' + statusKind(result.status);
  status.textContent = String(result.status);
  const line = document.createElement('span');
  line.className = 'request-line';
  line.textContent = result.method + ' ' + result.path;
  const meta = document.createElement('span');
  meta.className = 'meta';
  meta.textContent = result.ms + ' ms · ' + formatBytes(result.bytes);
  const copy = document.createElement('button');
  copy.type = 'button';
  copy.className = 'ghost';
  copy.textContent = '复制响应';
  copy.addEventListener('click', () => {
    copyWithFeedback(copy, state.responseText, [ '已复制', '复制失败', '复制响应' ]);
  });
  head.append(status, line, meta);
  if (result.requestId) {
    const requestId = document.createElement('span');
    requestId.className = 'meta request-id';
    requestId.textContent = 'x-request-id: ' + result.requestId;
    head.append(requestId);
  }
  head.append(copy);

  const pre = document.createElement('pre');
  pre.className = 'body';
  pre.textContent = result.pretty || '（空）';

  const details = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = '响应头';
  const list = document.createElement('dl');
  result.headers.forEach(item => {
    const dt = document.createElement('dt');
    dt.textContent = item[0];
    const dd = document.createElement('dd');
    dd.textContent = item[1];
    list.append(dt, dd);
  });
  details.append(summary, list);
  dom.responseEl.append(head, pre, details);
}
