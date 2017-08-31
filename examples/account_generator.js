/**
 * A simple account generator that registers a set amount of randomly
 * generated device_uids at Jodel's API. For this to work there must be a valid
 * client version and the corresponding signing key set in the config module.
 */

const api = require('../lib/api');
const locations = require('../lib/locations');

const QUANTITY = 5;


// Generate @QUANTITY device_uids
const device_uids = [];
for(let i = 0; i < QUANTITY; i++) {
  const duid = api.generate_deviceuid();
  device_uids.push(duid);
}

// To register a device_uid we need to request a new access token. For that we
// need some location details, eg. Würzburg
const location = locations[0];

const promisesToResolve = device_uids.map(duid => {
  return {
    promise: api.request_token(duid, location.latitude, location.longitude, location.name, location.country_code),
    device_uid: duid
  };
});

// Resolve all promises and write the successfully registered device_uids
// to console.

function register(remainingPromises) {
  if(remainingPromises.length === 0) {
    return;
  }

  const next = remainingPromises[0];
  next.promise
    .then(response => {
      if(response.statusCode === 200) {
        console.log('Successfully registered ' + next.device_uid);
        return register(remainingPromises.slice(1, remainingPromises.length));
      }
    })
    .catch(error => {
      console.error(error);
    });

}

register(promisesToResolve);
