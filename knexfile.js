/**
 * @file This is a global configuration file for knex' command line interface.
 * Knex is used for database abstraction and migrations. When using it's cli,
 * knex loads the node.js-specific environment variable `NODE_ENV` and evaluates
 * it's value to determine which connection details should be used. Since
 * our configuration already contains environment-specific information, we just
 * pass the needed connection credentials for each environment ourselves.
 * See more here: http://knexjs.org
 */


const config = require('./config');

module.exports = {
	development: config.knex,
	connection: config.knex,
	production: config.knex
}
