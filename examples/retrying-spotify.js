// Retrying Spotify client.
// Transparently refreshes access_token when Spotify API returns 401 Unauthorized.

const _ = require('lodash');
const SpotifyWebApi = require('spotify-web-api-node');
const promiseRetryify = require('promise-retryify');

function createClient() {
  return new SpotifyWebApi({
    clientId: process.env.SPOTIFY_CLIENT_ID,
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    redirectUri: process.env.SPOTIFY_REDIRECT_URI,
    refreshToken: process.env.SPOTIFY_REFRESH_TOKEN,
  });
}

function createRetryingClient() {
  const client = createClient();

  return promiseRetryify(client, {
    // The subsequent call should work after the access_token has been refreshed
    maxRetries: 1,
    // milliseconds
    retryTimeout: () => 100,

    shouldRetry: (err) => {
      console.log('Error when requesting Spotify API', err);

      if (err.statusCode === 401) {
        // Only retry at Unauthorized response, it most probably means we
        // need to refresh access_token.
        return true;
      }

      return false;
    },

    beforeRetry: () => {
      console.log('Refreshing access token and retrying ..');
      return refreshToken(client);
    },

    // Omit "private" methods
    attributePicker: name => name[0] !== '_',
  });
}

function refreshToken(client) {
  return client.refreshAccessToken()
    .then(data => client.setAccessToken(data.body.access_token))
    .catch((err) => {
      console.log('Error when refreshing access token', err);
      throw err;
    });
}

module.exports = createRetryingClient;
