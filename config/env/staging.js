/**
 * @file Environment-specific configuration for staging
 */

const config = {
	// DB credentials
	DB_USER: process.env.DB_USER,
	DB_PASS: process.env.DB_PASS,
	DB_HOST: process.env.DB_HOST,
	DB_NAME: process.env.DB_NAME
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
