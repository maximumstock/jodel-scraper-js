/**
 * @file This is a simple example that exports scraped Jodels
 * into a Postgres database (or any other database that is supported
 * by knex.js for that matter).
 */

const knex = require('knex')({
  client: 'postgres',
  connection: process.env.DB_CONNECTION
});
const DynamicScraper  = require('../../lib/scraper');
const locations       = require('../../lib/locations');
const device_uids     = require('../../device_uids.json');

// Handler function that gets passed to each scraper instance
async function handler(jodels, scraper) {
  console.log(`Handling ${jodels.length} Jodels`);
  // Map Jodels to the database table structure
  jodels = jodels.map(j => {
    return {
      post_id: j.post_id,
      data: j,
      location: {
        latitude: scraper.location.latitude,
        longitude: scraper.location.longitude,
        name: scraper.location.name
      }
    };
  });
  // Insert Jodels
  jodels.forEach(jodel => insertSingleJodel(jodel));
}

async function insertSingleJodel(jodel) {
  try {
    await knex('jodels').insert(jodel);
  } catch (e) {
    // Ignore unique constraint violation errors aka "we already got that Jodel"
    if(e.code === '23505') {
      return;
    } else {
      throw e;
    }
  } 
}

// Create several scrapers for several locations, with one device_uid each and
// subscribe our handler function
for(let i = 0; i < 20; i++) {
  const location    = locations[i];
  const device_uid  = device_uids[i];
  const s = new DynamicScraper(device_uid, location);
  s.subscribe(handler);
  // Only start one scraper every two seconds, to not get rate-limited instantly
  setTimeout(() => {
    s.start();
  }, i*2000);
}
