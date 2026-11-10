import { dom, state, saveHistory } from './state.js';
import { applyEndpoint } from './nav.js';

export function addHistory(item) {
  state.history = [ item, ...state.history ].slice(0, 20);
  saveHistory();
  renderHistory();
}

export function renderHistory() {
  dom.historyEl.replaceChildren();
  if (!state.history.length) {
    const empty = document.createElement('p');
    empty.className = 'empty';
    empty.textContent = '还没有请求。';
    dom.historyEl.append(empty);
    return;
  }
  state.history.forEach(item => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'history-item';
    const time = document.createElement('span');
    time.textContent = item.at;
    const badge = document.createElement('span');
    badge.className = 'method method-' + item.method;
    badge.textContent = item.method;
    const route = document.createElement('span');
    route.textContent = item.path;
    const code = document.createElement('span');
    code.textContent = String(item.status);
    button.title = item.requestId ? 'x-request-id: ' + item.requestId : '';
    button.append(time, badge, route, code);
    button.addEventListener('click', () => {
      applyEndpoint({
        id: '',
        method: item.method,
        path: item.path,
        headers: item.headers || '',
        body: item.body || '',
        hint: '来自最近请求，可以修改后再发送。',
      });
    });
    dom.historyEl.append(button);
  });
}
