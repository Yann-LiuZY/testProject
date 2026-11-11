'use strict';

const INVALID_TAB_IDS_MESSAGE = 'tabIds must be an array of 1 to 50 non-empty strings';

/**
 * Validate tabIds and return trimmed strings in the original order.
 * @param {*} tabIds Raw tabIds value.
 * @return {{ ok: true, tabIds: string[] } | { ok: false, message: string }} Parsed result.
 */
function parseTouchTabIds(tabIds) {
  if (!Array.isArray(tabIds) || tabIds.length < 1 || tabIds.length > 50) {
    return { ok: false, message: INVALID_TAB_IDS_MESSAGE };
  }

  const parsed = [];
  for (const item of tabIds) {
    if (typeof item !== 'string' || item.trim() === '') {
      return { ok: false, message: INVALID_TAB_IDS_MESSAGE };
    }
    parsed.push(item.trim());
  }
  return { ok: true, tabIds: parsed };
}

/**
 * Resolve maxTabs the same way as page-visit getMaxTabs.
 * @param {*} configured Configured maxTabs value.
 * @return {number} Effective maxTabs.
 */
function resolveMaxTabs(configured) {
  if (typeof configured === 'number' && Number.isFinite(configured) && configured >= 0) {
    return configured;
  }
  return 100;
}

/**
 * Move a record to the end of the Map so order matches last opened.
 * @param {Map} store Page visit store.
 * @param {string} tabId Tab id.
 * @param {object} record Visit record.
 */
function touchRecord(store, tabId, record) {
  if (store.has(tabId)) {
    store.delete(tabId);
  }
  store.set(tabId, record);
}

/**
 * Evict least recently opened records, keeping the current tab.
 * @param {Map} store Page visit store.
 * @param {number} maxTabs Capacity.
 * @param {string} currentTabId Tab opened by this step.
 */
function evictLeastRecentlyOpened(store, maxTabs, currentTabId) {
  while (store.size > maxTabs) {
    let oldestId;
    let oldestAt;
    for (const [ id, record ] of store) {
      if (id === currentTabId) {
        continue;
      }
      if (oldestAt === undefined || record.lastOpenedAt < oldestAt) {
        oldestAt = record.lastOpenedAt;
        oldestId = id;
      }
    }
    if (oldestId === undefined) {
      break;
    }
    store.delete(oldestId);
  }
}

/**
 * Touch page visits in order and evict least recently opened tabs.
 * @param {Map} store Page visit store.
 * @param {string[]} tabIds Trimmed non-empty tab ids, duplicates allowed.
 * @param {{ now: string, requestId: string, maxTabs: number }} options Touch options.
 * @return {{ accepted: number, total: number }} Touch result.
 */
function touchPageVisits(store, tabIds, { now, requestId, maxTabs }) {
  for (const tabId of tabIds) {
    const previous = store.get(tabId);
    const record = {
      tabId,
      requestId,
      openedAt: previous ? previous.openedAt : now,
      lastOpenedAt: now,
      openCount: previous ? previous.openCount + 1 : 1,
    };
    touchRecord(store, tabId, record);
    evictLeastRecentlyOpened(store, maxTabs, tabId);
  }
  return { accepted: tabIds.length, total: store.size };
}

module.exports = { parseTouchTabIds, resolveMaxTabs, touchPageVisits };
