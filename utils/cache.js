const NodeCache = require('node-cache');

const cache = new NodeCache({
  stdTTL: 60, // seconds
  checkperiod: 120,
  useClones: false,
});

const flushByPrefix = (prefix) => {
  const keys = cache.keys();
  if (!keys.length) return;
  const keysToDelete = keys.filter((key) => key.startsWith(prefix));
  if (keysToDelete.length) {
    cache.del(keysToDelete);
  }
};

module.exports = {
  cache,
  flushByPrefix,
};


