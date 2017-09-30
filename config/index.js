/**
 * @file A central configuration object
 */

module.exports = {
  
      JODEL_API_HOST: 'https://api.go-tellm.com',
      JODEL_API_V2: 'https://api.go-tellm.com/api/v2',
      JODEL_API_V3: 'https://api.go-tellm.com/api/v3',
  
      // Android client version of Jodel, see Google PlayStore
      CLIENT_VERSION: '4.63.0',
      // static ID that is identical for all Android client versions
      // (see various implementations on GitHub)
      CLIENT_ID: '81e8a76e-1e02-4d17-9ba0-8a7020261b26',
      // signing key for HMAC generation for this client version
      SECRET: 'kHOqgoYZfmydKOzpWrIKfaUTmiCQuydZrSigayvB'
  };
