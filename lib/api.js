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

const config = require('../config');

/**
 * Generates a HMAC that is used to identify as a client. Sending a valid
 * HMAC is required by the API.
 * (https://de.wikipedia.org/wiki/Keyed-Hash_Message_Authentication_Code)
 * @param {string} token
 * @param {string} method
 * @param {string} url
 * @param {string} body
 */
function generate_hmac(token, method, url, body, timestamp) {
  const parsed_url = _url.parse(url);
  const raw = method.toUpperCase() + '%' + url.host + '%' + 443 + '%' + url.path + '/%' + (token || '') + '%' + timestamp + '%' + url.query + '%' + body;
  // alternative string that is built in official app (self-mined)
  // const raw2 = method.toUpperCase() + '@' + url.path + '%' + url.host + '%' + 443 + '%' + url.path + '/%' + (token || '') + '%' + url.query + '%' + body;
  const hmac = crypto.createHmac('sha1', config.SECRET);
  hmac.setEncoding('hex');
  hmac.write(raw);
  hmac.end();
  // upper string just because the official Jodel app does it that way
  return hmac.read().toUpperCase();
}

function generate_timestamp() {
  const date = new Date().toISOString();
  // some python implementation on GitHub did this to get rid of the millisecond
  // part of the timestamp; this should be proof of how desperate i was to get
  // this to work
  return date.slice(0, date.length - 5) + 'Z';
}


/**
 * Returns an object containing all relevant default headers plus any additional
 * headers
 * @param {object} options
 */
function default_headers(options = {}) {

  const headers = {
    'User-Agent': `Jodel/${config.CLIENT_VERSION} Dalvik/2.1.0 (Linux; U; Android 5.1.1; )`,
    'Content-Type': 'application/json; charset=utf-8',
    'Accept-Encoding': 'gzip',
    'X-Client-Type': `android_${config.CLIENT_VERSION}`,
    'X-Api-Version': '0.2'
  };

  if(options.timestamp) {
    headers['X-Timestamp'] = options.timestamp;
  }

  if(options.hmac) {
    headers['X-Authorization'] = `HMAC ${options.hmac}`;
  }

  if(options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
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
function request_token(device_uid, latitude, longitude, location_name = '', country_code = '', location_accuracy = 0.0) {

  const payload = {
    client_id: config.CLIENT_ID,
    device_uid: device_uid,
    location: {
      name: location_name,
      city: location_name,
      country: country_code,
      loc_accuracy: location_accuracy,
      loc_coordinates: {
        lat: latitude,
        lng: longitude
      }
    }
  };

  const url = `${config.JODEL_API_V2}/users`;
  const timestamp = generate_timestamp();
  const hmac = generate_hmac('', 'POST', url, payload.toString(), timestamp);
  const headers = default_headers({
    hmac: hmac,
    timestamp: timestamp
  });

  return request.post(url).send(payload).set(headers);

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
 * Retrieves a single Jodel with its comments
 * @param {string} token
 * @param {string} id
 */
function get_single_jodel(token, id) {

  return new Promise((resolve, reject) => {

    const url = `${config.JODEL_API_V2}/posts/${id}`;
    const timestamp = generate_timestamp();
    const hmac = generate_hmac(token, 'GET', url, '', timestamp);
    const headers = default_headers({
      hmac: hmac,
      token: token,
      timestamp: timestamp
    });

    return request.get(url).set(headers)
      .then(resolve)
      .catch(reject);

  });

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

    const timestamp = generate_timestamp();
    const hmac = generate_hmac(token, 'GET', url, '', timestamp);
    const headers = default_headers({
      hmac: hmac,
      token: token,
      timestamp: timestamp
    });

    // there is no point NOT requesting the maximum number of Jodels per request,
    // so we just set it here
    query.limit = 100;

    return request.get(url).set(headers).query(query)
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
  get_feed: get_feed,
  get_single_jodel: get_single_jodel
}
