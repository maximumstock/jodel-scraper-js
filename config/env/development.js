/**
 * @file Environment-specific configuration for development
 */

const config = {
	// DB credentials
	DB_USER: 'jodel',
	DB_PASS: 'jodel',
	DB_HOST: 'localhost',
	DB_NAME: 'jodel2'
}

config.knex = {
	client: 'postgresql',
	connection: {
		database: config.DB_NAME,
		user:			config.DB_USER,
		password:	config.DB_PASS,
		host:			config.DB_HOST
	},
	pool: {
		min: 2,
		max: 10
	}
}

module.exports = config;
