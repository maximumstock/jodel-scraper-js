/**
 * A simple testing setup to check whether single-scraper authentication works
 */


const config    = require('../config');
const api       = require('../lib/api');
const locations = require('../lib/locations');

const loc = locations[0];
// just some already registered device_uid for testing
const device_uid = 'ebed57121e34e6979b6031d332ddaa658e99e2fb6c199a27113fcee96b12ab76';

api.request_token(device_uid, loc.latitude, loc.longitude)
  .then(response => {
    console.log(response);
  })
  .catch(error => {
    console.error(error);
  })