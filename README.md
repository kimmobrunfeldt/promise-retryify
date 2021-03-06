# promise-retryify

> Add retry functionality to any Promise based library

[![Build Status](https://travis-ci.org/kimmobrunfeldt/promise-retryify.svg?branch=master)](https://travis-ci.org/kimmobrunfeldt/promise-retryify) *master branch status*

[![NPM Badge](https://nodei.co/npm/promise-retryify.png?downloads=true)](https://www.npmjs.com/package/promise-retryify)


**Features**

* Works with any library / module / object which has methods that return Promises. Also individual functions can be retryified.
* Everything can be highly customized, including backoff strategy
* Doesn't mutate given object

**Example**

```js
const SpotifyWebApi = require('spotify-web-api-node');
const promiseRetryify = require('promise-retryify');

const spotify = new SpotifyWebApi({ /* options .. */ });
const retryingSpotify = promiseRetryify(spotify);

// Voila! We have now a clone of the Spotify API, which supports retrying of
// API calls. The API is exactly the same as in the original library, but it
// transparently retries failed calls.
retryingSpotify.searchTracks('Adele')
  .then(result => console.log(result))
  .catch(err => {
    // We only end up here if the underlying `spotify.searchTracks('Adele')`
    // failed enough times and we stopped retrying.
  });
```

The above is often not enough and you need more customization.
[See a real-life example](examples/retrying-spotify.js) of wrapping
the spotify-web-api-node library.

[More examples here](#examples).

## Install

```bash
npm install promise-retryify --save
```

Node 6+ supported. Browsers are not supported at the moment. It would require:

* Promise polyfill / use Bluebird Promises
* Transpile the src/index.js to ES5

## API

### promiseRetryify(object, [opts])

If `object` is a JS Object, returns a clone of `object` where each function attribute has been wrapped to
retry when a rejected Promise is returned. Also `object`'s **prototype**
methods are iterated. Note that the `object` is **not** deeply traversed, only
the first-level attributes are iterated.

If `object` is a Function, returns a new wrapper function which retries when a rejected Promise is returned from the original function.

`opts.attributePicker` may be used to customize
which functions are wrapped. All non-function attributes are left as is. Has no effect if passed `object` is a Function.

Retrying is done only when a function returns Promise object. Other values
are ignored.

#### `object`

May be a JS Object or Function. Object should be iterable with a `for` loop.

#### `opts`

Most options are functions to allow maximal customization. The values
listed below are the defaults.

```js
{
  // Retry count overrides even though shouldRetry returns true
  // For unlimited retries, use Infinity.
  // To disable retrying, use 0.
  //
  // The first try is not counted as a "retry". If e.g. opts.maxRetries = 1,
  // The original API is called twice in the worst scenario:
  //   1. The real try
  //   2. The first retry
  maxRetries: 5,

  // Function which should return Number. Number is the timeout before retrying
  // in milliseconds. `retryCount` is the amount of retries already executed.
  // For the first retry event, the value of `retryCount` equals 0.
  retryTimeout: retryCount => 500,

  // Function which should return a Boolean.
  //  true:  retry will be executed if maxRetries hasn't been reached yet
  //  false: retrying will be skipped
  // Function gets the Promise rejection error value as the first parameter.
  shouldRetry: err => true,

  // Function which should return a Promise or undefined.
  // Executed before each retry. Can return a Promise for async operations.
  // For example this could be used to refresh oauth2 access_token before
  // retrying a request.
  beforeRetry: retryCount => Promise.resolve(),

  // Function which should return a Boolean.
  // When looping each attribute of the given `object`, this method will be
  // called to decide if the attribute should be wrapped or not.
  //
  //  true:  attribute should be wrapped with retry
  //  false: attribute should be left as is
  // Function gets the object attribute name as the first parameter.
  // Has no effect if passed `object` is a Function.
  attributePicker: attrKey => true,

  // Function which is called if all calls failed.
  // Function gets the error object of the last retry call as the first
  // parameter.
  // Rest parameters match to the original function's parameters
  onAllFailed: (lastErr, param1, param2) => console.log('All calls failed!');
}
```

## Examples

Example configurations, using Spotify API as the wrapped library.
Assume that these modules have been require'd:

```js
const SpotifyWebApi = require('spotify-web-api-node');
const promiseRetryify = require('promise-retryify');
```

### Wrapping single function

```js
const readFileAsync = BPromise.promisify(require('fs').readFile)
const retryingRead = promiseRetryify(readFileAsync);
// Now when calling `retryingRead`, it will retry file reading
// with default options
```

### Exponential backoff

```js
const spotify = new SpotifyWebApi({ /* options .. */ });
const retryingSpotify = promiseRetryify(spotify, {
  // 1sec, 2secs, 4secs, 8secs, 16secs, 32secs ...
  retryTimeout: (retryCount) => Math.pow(2, retryCount) * 1000
});
```

### Omit "private" attributes

*There's no such thing as real private in JavaScript but underscore prefix
is used to communicate privateness.*

```js
const spotify = new SpotifyWebApi({ /* options .. */ });
const retryingSpotify = promiseRetryify(spotify, {
  // Omit "private" methods
  attributePicker: attrName => attrName[0] !== '_',
});
```

### Infinite retries

```js
const spotify = new SpotifyWebApi({ /* options .. */ });
const retryingSpotify = promiseRetryify(spotify, {
  maxRetries: Infinity
  // Note: shouldRetry can be used to stop retrying on certain errors
});
```

## License

MIT
