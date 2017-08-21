/**
 * A simple testing setup to check whether single-scraper authentication works
 */


const config    = require('../config');
const api       = require('../lib/api');
const locations = require('../lib/locations');

const loc = locations[0];
const device_uid = config.DEVICE_UID || api.generate_deviceuid();

api.request_token(device_uid, loc.latitude, loc.longitude)
  .then(response => {
    console.log(response);
  })
  .catch(error => {
    console.error(error);
  })
