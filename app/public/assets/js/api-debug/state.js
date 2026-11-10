import { endpoints } from './endpoints.js';

const HISTORY_KEY = 'api-debug-history';
const FAVORITES_KEY = 'api-debug-favorites';

export const dom = {
  methodEl: document.getElementById('method'),
  pathEl: document.getElementById('path'),
  headersEl: document.getElementById('headers'),
  bodyEl: document.getElementById('body'),
  bodyField: document.getElementById('body-field'),
  hintEl: document.getElementById('hint'),
  errorEl: document.getElementById('form-error'),
  sendEl: document.getElementById('send'),
  formatEl: document.getElementById('format'),
  curlEl: document.getElementById('curl'),
  searchEl: document.getElementById('search'),
  responseEl: document.getElementById('response'),
  historyEl: document.getElementById('history'),
  navEl: document.getElementById('nav'),
  clearHistoryEl: document.getElementById('clear-history'),
};

export const state = {
  activeId: endpoints[0].id,
  inflight: null,
  responseText: '',
  history: loadHistory(),
  favorites: loadFavorites(),
};

export function setError(message) {
  dom.errorEl.textContent = message || '';
}

export function saveHistory() {
  sessionStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, 20)));
}

export function saveFavorites() {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(Array.from(state.favorites)));
  } catch (err) {
    // 隐私模式下 localStorage 可能不可用，收藏只在当前页面生效
  }
}

function loadHistory() {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 20) : [];
  } catch (err) {
    return [];
  }
}

function loadFavorites() {
  try {
    const parsed = JSON.parse(localStorage.getItem(FAVORITES_KEY) || '[]');
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter(id => endpoints.some(endpoint => endpoint.id === id)));
  } catch (err) {
    return new Set();
  }
}
