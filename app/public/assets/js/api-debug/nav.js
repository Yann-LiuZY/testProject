import { endpoints } from './endpoints.js';
import { dom, state, setError, saveFavorites } from './state.js';
import { methodHasBody } from './utils.js';

export function syncBodyVisibility() {
  dom.bodyField.hidden = !methodHasBody(dom.methodEl.value);
}

export function applyEndpoint(endpoint) {
  state.activeId = endpoint.id;
  dom.methodEl.value = endpoint.method;
  dom.pathEl.value = endpoint.path;
  dom.headersEl.value = endpoint.headers || '';
  dom.bodyEl.value = endpoint.body;
  dom.hintEl.textContent = endpoint.hint;
  setError('');
  syncBodyVisibility();
  renderNav();
}

function toggleFavorite(id) {
  if (state.favorites.has(id)) {
    state.favorites.delete(id);
  } else {
    state.favorites.add(id);
  }
  saveFavorites();
  renderNav();
}

function matchesSearch(endpoint) {
  const query = dom.searchEl.value.trim().toLowerCase();
  if (!query) return true;
  return [ endpoint.group, endpoint.name, endpoint.method, endpoint.path ]
    .some(value => value.toLowerCase().includes(query));
}

function groupLabel(text) {
  const label = document.createElement('div');
  label.className = 'group-label';
  label.textContent = text;
  return label;
}

function endpointRow(endpoint) {
  const row = document.createElement('div');
  row.className = 'endpoint-row';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'endpoint' + (endpoint.id === state.activeId ? ' is-active' : '');
  if (endpoint.id === state.activeId) button.setAttribute('aria-current', 'true');
  const badge = document.createElement('span');
  badge.className = 'method method-' + endpoint.method;
  badge.textContent = endpoint.method;
  const text = document.createElement('span');
  const name = document.createElement('span');
  name.className = 'endpoint-name';
  name.textContent = endpoint.name;
  const route = document.createElement('span');
  route.className = 'endpoint-path';
  route.textContent = endpoint.path;
  text.append(name, route);
  button.append(badge, text);
  button.addEventListener('click', () => applyEndpoint(endpoint));

  const favorite = state.favorites.has(endpoint.id);
  const star = document.createElement('button');
  star.type = 'button';
  star.className = 'star' + (favorite ? ' is-on' : '');
  star.textContent = favorite ? '★' : '☆';
  star.title = favorite ? '取消收藏' : '收藏此接口';
  star.setAttribute('aria-label', star.title);
  star.setAttribute('aria-pressed', String(favorite));
  star.addEventListener('click', () => toggleFavorite(endpoint.id));

  row.append(button, star);
  return row;
}

export function renderNav() {
  dom.navEl.replaceChildren();
  const visible = endpoints.filter(matchesSearch);
  if (!visible.length) {
    const empty = document.createElement('p');
    empty.className = 'empty nav-empty';
    empty.textContent = '没有匹配的接口。';
    dom.navEl.append(empty);
    return;
  }

  const pinned = visible.filter(endpoint => state.favorites.has(endpoint.id));
  if (pinned.length) {
    dom.navEl.append(groupLabel('收藏'));
    pinned.forEach(endpoint => dom.navEl.append(endpointRow(endpoint)));
  }

  let currentGroup = '';
  visible.forEach(endpoint => {
    if (endpoint.group !== currentGroup) {
      currentGroup = endpoint.group;
      dom.navEl.append(groupLabel(currentGroup));
    }
    dom.navEl.append(endpointRow(endpoint));
  });
}
