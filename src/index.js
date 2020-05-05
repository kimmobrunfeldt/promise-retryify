const _ = require('lodash');

function isPromise(obj) {
  return _.isFunction(_.get(obj, 'then'));
}

function createRetryFunction(originalObj, func, opts) {
  function retry(/* arguments */) {
    // Keep state in retry function's this scope when running the recursive
    // loop
    const retryThis = this;
    if (!_.isNumber(retryThis.retries)) {
      retryThis.retries = 0;
    }

    const args = Array.prototype.slice.call(arguments);

    const ret = func.apply(originalObj, args);
    if (isPromise(ret)) {
      return ret.catch((err) => {
        const maxRetriesReached = retryThis.retries >= opts.maxRetries;

        if (opts.shouldRetry(err) && !maxRetriesReached) {
          return new Promise((resolve, reject) => {
            retryThis.retries += 1;

            setTimeout(() => {
              Promise.resolve(opts.beforeRetry(retryThis.retries, args))
                // Recursively call `retry` function
                // XXX: We are assuming that all subsequent calls of `func`
                //      return a Promise too.
                .then(() => retry.apply(retryThis, args))
                .then(function resolver() {
                  // Promise should resolve with single value, but pass all
                  // parameters to the resolve just in case.
                  resolve.apply(this, arguments);
                })
                .catch(err2 => reject(err2));
            }, opts.retryTimeout(retryThis.retries));
          });
        }

        if (_.isFunction(opts.onAllFailed)) {
          opts.onAllFailed.apply(originalObj, [err].concat(args));
        }

        throw err;
      });
    }

    return ret;
  }

  return function retryWrapper() {
    // This extra wrapper will ensure that each call will get a fresh
    // state to `this` inside retry function.
    // I.e. retries counter will be reset on each function call
    return retry.apply({}, arguments);
  };
}

function retryWrap(obj, _opts) {
  const opts = _.merge({
    // Decision function which gets the Promise rejection error as a parameter
    // Should return true of false synchronously
    shouldRetry: err => true,

    // Executed before each retry. Can return a Promise for async operations
    beforeRetry: tryCount => Promise.resolve(),

    // Retry count overrides even though shouldRetry returns true
    // For unlimited retries, use Infinity.
    // To disable retrying, use 0.
    maxRetries: 5,

    // Timeout before retrying
    retryTimeout: tryCount => 500,

    attributePicker: attrKey => true,

    onAllFailed: err => null,
  }, _opts);

  if (_.isFunction(obj)) {
    return _retryWrapFunction(obj, opts);
  }

  return _retryWrapObject(obj, opts);
}

function _retryWrapObject(obj, opts) {
  const objCopy = {};

  // Intentionally also iterate through prototype properties, not just own
  // properties.
  for (let key in obj) {  // eslint-disable-line
    const val = obj[key];

    if (_.isFunction(val) && opts.attributePicker(key)) {
      objCopy[key] = _.bind(createRetryFunction(obj, val, opts), obj);
    } else {
      objCopy[key] = val;
    }
  }

  return objCopy;
}

function _retryWrapFunction(func, opts) {
  return _.bind(createRetryFunction(func, func, opts), func);
}

module.exports = retryWrap;
