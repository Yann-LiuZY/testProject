import { endpoints } from './endpoints.js';
import { dom, state, saveHistory } from './state.js';
import { applyEndpoint, renderNav, syncBodyVisibility } from './nav.js';
import { renderHistory } from './history.js';
import { send, copyCurl, formatBody } from './request.js';

function init() {
  dom.methodEl.addEventListener('change', () => {
    syncBodyVisibility();
    state.activeId = '';
    renderNav();
  });
  dom.pathEl.addEventListener('input', () => {
    state.activeId = '';
    renderNav();
  });
  dom.sendEl.addEventListener('click', send);
  dom.formatEl.addEventListener('click', formatBody);
  dom.curlEl.addEventListener('click', copyCurl);
  dom.searchEl.addEventListener('input', renderNav);
  dom.searchEl.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      dom.searchEl.value = '';
      renderNav();
    }
  });
  dom.clearHistoryEl.addEventListener('click', () => {
    state.history = [];
    saveHistory();
    renderHistory();
  });
  document.addEventListener('keydown', event => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault();
      send();
    }
  });

  applyEndpoint(endpoints[0]);
  renderHistory();
}

init();
