const config  = require('./config');
const api     = require('./lib/api');
const locations = require('./lib/locations');

const loc = locations[0];
loc.accuracy = 0;

api.request_token(loc.latitude, loc.longitude)
  .then(response => {
    console.log(response);
  })
  .catch(error => {
    console.error(error);
  })
