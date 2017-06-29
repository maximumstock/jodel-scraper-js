/**
 * @file Basic client implementation of Jodel's API
 * Supports:
 * - authorization/requesting new tokens
 * - fetching feeds
 * - fetching single Jodels and their comments
 */

const request = require('superagent');
const crypto = require('crypto');
const _url = require('url');

const logger = require('./logger');
const config = require('../config');


/**
 * Builds a query string based of `parameters`
 * @param {object} parameters
 */
function build_query_string(parameters) {
  const query_string = Object.keys(parameters).map(key => {
    return `${encodeURIComponent(key)}=${encodeURIComponent(parameters[key])}`;
  }).join('&');
  return query_string.length > 0 ? `?${query_string}` : '';
}


/**
 * Generates a HMAC that is used to identify as a client. Sending a valid
 * HMAC is required by the API.
 * (https://de.wikipedia.org/wiki/Keyed-Hash_Message_Authentication_Code)
 * @param {string} token
 * @param {string} method
 * @param {string} url
 * @param {string} body
 */
function generate_hmac(token, method, url, body) {

  const parsed_url = _url.parse(url);
  const timestamp = new Date().toISOString();

  // Build a string to hash
  // This is the way the official Jodel app does it
  const raw = method + "%" + url.host + "%" + 443 + "%" + url.path +
    "%" + token + "%" + timestamp + "%" + "" + "%" + body;

  const hmac = crypto.createHmac('sha1', crypto.randomBytes(20));
  hmac.setEncoding('hex');
  hmac.write(raw);
  hmac.end();
  // upper string just because the official Jodel app does it that way
  return hmac.read().toUpperCase();
}

function generate_deviceuid(salt) {
  // return crypto.createHash('sha256').update(salt).digest('hex');
  return config.DEVICE_UID;
}

/**
 * Returns an object containing all relevant default headers plus any additional
 * headers
 * @param {object} options
 */
function default_headers(options = {}) {

  const headers = {
    'User-Agent': `Jodel/${config.CLIENT_VERSION} Dalvik/2.1.0 (Linux; U; Android 6.0.1; A0001 Build/MHC19Q`,
    'Accept-Encoding': 'gzip',
    'X-Client-Type': `android_${config.CLIENT_VERSION}`,
    'X-Api-Version': '0.2',
    'X-Timestamp': new Date().toISOString(),
    'Authorization': options.token ? `Bearer ${options.token}` : null,
    'X-Authorization': options.hmac ? `HMAC ${options.hmac.toString()}` : null
  }

  return headers;
}


/**
 * Requests a new API token for the given location information and returns a
 * promise that contains the request result
 * @param {number} latitude
 * @param {number} longitude
 * @param {string} location_name
 * @param {string} country_code
 * @param {string} location_accuracy
 */
function request_token(latitude, longitude, location_name = '', country_code = '', location_accuracy = 0) {

  return new Promise((resolve, reject) => {
    const payload = {
      client_id: config.CLIENT_ID,
      device_uid: generate_deviceuid(`${latitude}-${longitude}-${crypto.randomBytes(20)}`), //,
      location: {
        city: location_name,
        country: country_code,
        loc_accuracy: location_accuracy,
        loc_coordinates: {
          lat: latitude,
          lng: longitude
        }
      }
    }

    const url = `${config.JODEL_API_V2}/users`;
    const hmac = generate_hmac('', 'POST', url, payload.toString());
    const headers = default_headers({
      hmac: hmac
    });

    return request.post(url).send(payload).set(headers)
      .then(resolve)
      .catch(reject);
  });

}

function map_feed_to_string(feed) {
  switch (feed) {
    case 'popular':
      return 'popular';
    case 'discussed':
      return 'discussed';
    default:
      return '';
  }
}


/**
 *
 * @param {string} token
 * @param {string} id
 */
function get_single_jodel(token, id) {

}


/**
 * Requests a given feed with a given token
 * @param {string} token
 * @param {string} feed
 * @param {object} query - Must contain `lat` and `lng` coordinate information
 * and mey contain optional parameters such as `limit` and `after`
 */
function get_feed_batch(token, feed, query = {}) {

  return new Promise((resolve, reject) => {

    let url = `${config.JODEL_API_V2}/posts/location`;
    // append the respective feed
    const mapped_feed = map_feed_to_string(feed);
    if(mapped_feed.length > 0) {
      url += `/${mapped_feed}`;
    }

    const hmac = generate_hmac(token, 'GET', url, '');
    const headers = default_headers({
      hmac: hmac,
      token: token
    });

    // there is no point NOT requesting the maximum number of Jodels per request,
    // so we just set it here
    query.limit = config.MAX_JODELS_PER_REQUEST;
    url += build_query_string(query);

    return request.get(url).set(headers)
      .then(resolve)
      .catch(reject);

  });

}


/**
 * Makes requests via `get_feed_batch()` until the whole specified feed is fetched
 * @param {string} token
 * @param {string} feed
 * @param {object} query - query parameters
 */
function get_feed(token, feed, query = {}) {

  return new Promise((resolve, reject) => {
    // Array to dump all consecutive request data into
    let data = [];

    function callback(response) {
      try {
        const jodels = response.body.posts;
        data = data.concat(jodels);
        if (jodels.length === 0) {
          // If the last response contained less Jodel than the (currently)
          // known maximum batch size, then we can stop. This `<`-relation
          // approach should not be changed, as it secures the code against
          // unexpected API changes regarding the maximum batch size.
          return resolve(data);
        } else {
          // If there are still more Jodels to expect, we have to tell the API
          // what Jodels to skip
          query.after = jodels[jodels.length - 1].post_id;

          return get_feed_batch(token, feed, query)
            .then(callback)
            .catch(reject);
        }
      } catch (e) {
        // If an exception is thrown, then there is no `response.body.posts`
        // structure available and we can propagate an error back.
        // Unlike the `reject(...)` invocation below, this is only called,
        // when the API returned a 2xx status code, but the response body
        // was still malformed or the structure of the API response has changed.
        // In this case, we want the whole operation (getting the whole feed)
        // to fail as well, but we don't need an error for this.
        return reject();
      }
    }

    // The `.catch(reject)` function is only called, when a network error
    // happens or if the API returns a non-2xx status code, such as 401 (if
    // the token expired during requests). In this case, we want the whole
    // operation (getting the whole feed) to fail, instead of just one
    // particular request.
    get_feed_batch(token, feed, query)
      .then(callback)
      .catch(reject);

  });

}


module.exports = {
  generate_hmac: generate_hmac,
  default_headers: default_headers,
  request_token: request_token,
  get_feed_batch: get_feed_batch,
  get_feed: get_feed
}
