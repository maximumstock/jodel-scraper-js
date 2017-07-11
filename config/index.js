/**
 * @file This module constructs and exports a configuration object based on
 * the default configuration below and the environment-specific configuration
 * that can be specified via the environment variable `NODE_ENV`.
 * `NODE_ENV` can be `development`, which is the default, `staging` or
 * `production`
 */

// the default configuration
const default_config = {

    JODEL_API_HOST: 'https://api.go-tellm.com',
    JODEL_API_V2: 'https://api.go-tellm.com/api/v2',

		// Android client version of Jodel, see Google PlayStore
    CLIENT_VERSION: '4.51.2',
		// static ID that is identical for all Android client versions
		// (see various implementations on GitHub)
    CLIENT_ID: '81e8a76e-1e02-4d17-9ba0-8a7020261b26',
		// structurally a SHA256 hash, but only works with `CLIENT_ID` above
    DEVICE_UID: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
		// apparently 100 is the maximum number of Jodels one can receive per request
		MAX_JODELS_PER_REQUEST: 100

};

function get_environment_config(env) {
	switch(env) {
		case 'development':	return require('./env/development.js');
		case 'staging':			return require('./env/staging.js');
		case 'production':	return require('./env/production.js')
		default:						return require('./env/development.js')
	}
}

// load configurations
let config = default_config;
const environment_config = get_environment_config(process.env.NODE_ENV);

// overwrite default configuration with environment-specific settings
Object.keys(environment_config).forEach(key => {
	config[key] = environment_config[key];
});

module.exports = config;
