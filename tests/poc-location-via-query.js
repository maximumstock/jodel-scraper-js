/**
 * @file Proof-of-Concept Example
 *
 * Basically this snippet of code tests whether we can scrape different
 * locations with the same access token. As access tokens usually encode
 * the location information that they were created with internally, we need
 * to find a way to override this location information so the API gives us
 * the feed results for a location other than the one encoded in the access
 * token.
 *
 * The following code requests an access token and scrapes some feed samples
 * for a given set of locations. It then reduces the gathered feed data to
 * a two-tuple. Said two-tuple consists of the location that that was used
 * for scraping and a list of city names that were found via Jodels API when
 * scraping for said first location.
 */



/**
 * RESULTS OF ABOVE TESTS - 2017-08-21
 *
 * Apparently, overriding location coordinates via query parameters does not
 * affect the resulting feed data
 */

const feeds     = ['recent']; //, 'popular', 'discussed'];
const locations = require('../lib/locations');
const config    = require('../config');
const knex      = require('knex')(config.knex);
const api       = require('../lib/api');

// set a base location that is passed when requesting our access token
// later on we'll try to overwrite our desired request location via query
// parameters
const baseLocation = locations[1];
// just some already registered device_uid for testing
const device_uid = 'ebed57121e34e6979b6031d332ddaa658e99e2fb6c199a27113fcee96b12ab76';

// request a token based on set base location
api.request_token(device_uid, baseLocation.latitude, baseLocation.longitude)
  .then(response => {
    const token = response.body.access_token;
    // for each feed-location combination that we want to scrape, get the
    // corresponding feed and map-reduce the feed to a
    // <scraping-location, list-of-found-city-names> tuple
    feeds.forEach(feed => {
      locations.slice(0, 2).forEach(location => {
        api.get_feed_batch(token, {lat: location.latitude, lng: location.longitude, stickies: false, home: false, skipHometown: false})
          .then(response => {
            const jodels = response.body.posts;
            // find all unique location names from unique jodels
            const foundLocations = jodels.map(post => {
              return post.location.name;
            }).reduce((acc, name) => {
              if(acc.indexOf(name) === -1) {
                acc.push(name);
              }
              return acc;
            }, []);
            console.log(location, foundLocations);
          })
          .catch(error => {
            console.error(error);
          });
      });
    });
  })
  .catch(error => {
    console.error(error);
  });