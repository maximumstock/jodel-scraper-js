/**
 * @file Proof-of-Concept example for using one distinct device_uid for each
 * location to scrape. 
 * 
 * Basically, this creates multiple scrapers - each with a distinct location
 * and device_uid - and logs the found cities in the Jodels each scraper
 * instance collected. If all scrapers find different city names - given they
 * each was given a different target location - we know that scraping one
 * location per device_uid works.
 */

const feeds       = ['recent', 'popular', 'discussed'];
const locations   = require('../lib/locations');
const device_uids = require('../device_uids.json');
const config      = require('../config');
const knex        = require('knex')(config.knex);
const api         = require('../lib/api');


// for an abritrary number (here : 3), do the following:
// - pair up a device_uid and a location from the static collections
// - request a token for given device_uid-location-combination
// - try to scrape a feed (eg. recent)
// - print found locations as a proof that we scraped different locations
for(let i = 0; i < 3; i++) {
  const location = locations[i];
  const device_uid = device_uids[i];

  api.request_token(device_uid, location.latitude, location.longitude, location.name)
    .then(response => {
      const token = response.body.access_token;
      api.get_feed(token)
        .then(feed => {
          // find all unique location names from unique jodels
          const foundLocations = feed.map(post => {
            return post.location.name;
          }). reduce((acc, name) => {
            if(acc.indexOf(name) === -1) {
              acc.push(name);
            }
            return acc;
          }, []);
          console.log(location, device_uid, foundLocations);
        })
        .catch(error => {
          throw error;
        });
    })
    .catch(error => {
      throw error;
    });

}