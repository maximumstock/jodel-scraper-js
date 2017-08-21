/**
 * @file Tests
 */

const feeds = ['recent']; //, 'popular', 'discussed'];
const locations = require('./lib/locations');
const DynamicScraper = require('./lib/scraper');

const config = require('./config');
const logger = require('./lib/logger');
const knex = require('knex')(config.knex);
const api = require('./lib/api');

// feeds.forEach(feed => {
//   locations.slice(1, 2).forEach(location => {
//     location.accuracy = 0;
//     const s = new DynamicScraper(feed, location);
//
//     function handler(jodels) {
//
//       logger.info(`${s.getDescription()}: Processing ${jodels.length} Jodels`);
//
//       const data = jodels.map(jodel => {
//         return {
//           latitude: location.latitude,
//           longitude: location.longitude,
//           location: location.name,
//           feed: feed,
//           created_at: new Date(),
//           updated_at: new Date(),
//           data: jodel
//         }
//       }).forEach(jodel => {
//         knex('jodels')
//           .whereRaw('data->>\'post_id\' = ?', jodel.data.post_id)
//           .where({
//             latitude: location.latitude,
//             longitude: location.longitude,
//             location: location.name,
//             feed: feed
//           })
//           .then(results => {
//             if (results.length > 0) {
//               const ids = results.map(e => e.id);
//               return knex('jodels').del().whereIn('id', ids);
//             }
//           })
//           .then(() => {
//             return knex('jodels').insert(jodel);
//           })
//           .catch(error => {
//             logger.error(error);
//           });
//       });
//
//     }
//
//     s.subscribe(handler);
//
//     s.start();
//
//   });
// });
