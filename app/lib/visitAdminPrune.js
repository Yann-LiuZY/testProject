'use strict';

/**
 * Prunes the page visit store in place down to maxTabs, evicting the
 * least recently opened records first.
 * @param {Map} store Page visit store.
 * @param {number} maxTabs Maximum number of records to keep.
 * @return {{ ok: true, removed: number, remaining: number } | { ok: false, message: string }} Result.
 */
function prunePageVisits(store, maxTabs) {
  if (!(Number.isInteger(maxTabs) && maxTabs >= 0 && maxTabs <= 1000)) {
    return { ok: false, message: 'maxTabs must be an integer between 0 and 1000' };
  }

  if (store == null) {
    return { ok: true, removed: 0, remaining: 0 };
  }

  const before = store.size;
  while (store.size > maxTabs) {
    let oldestId;
    let oldestAt;
    for (const [ id, record ] of store) {
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
  const remaining = store.size;
  return { ok: true, removed: before - remaining, remaining };
}

module.exports = { prunePageVisits };
