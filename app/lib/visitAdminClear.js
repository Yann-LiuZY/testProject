'use strict';

/**
 * Clears the page visit store in place.
 * @param {Map} store Page visit store.
 * @return {{ removed: number, remaining: number }} Clear result.
 */
function clearPageVisits(store) {
  if (store == null) {
    return { removed: 0, remaining: 0 };
  }

  const removed = store.size;
  store.clear();
  return { removed, remaining: 0 };
}

module.exports = { clearPageVisits };
