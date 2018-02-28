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
const CommentScraper  = require('../../lib/comment-scraper');
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
for (let i = 0; i < 20; i++) {
  const location    = locations[i];
  const device_uid  = device_uids[i];
  const options = {
    windup_delay: i*2 // don't start all at the same time, to avoid rate-limiting
  };
  const s = new DynamicScraper(device_uid, location, options);
  s.subscribe(handler);
  s.start();
}


/**
 * COMMENT SCRAPING BELOW
 * 
 * Comment Jodels are not included in the feed data, so for each Jodel, we have
 * to make another API request to get all data, including the comments.
 */

const commentScraper = new CommentScraper(device_uids[device_uids.length - 1], locations[0]);
commentScraper.subscribe(commentHandler);
triggerComments();


async function triggerComments() {
  try {
    const result = await knex.raw(`SELECT * FROM jodels WHERE processed is false and parent is null LIMIT 10`);
    if (result.rows.length === 0) {
      await setTimeout(() => {}, 60000)
      return triggerComments();
    }
    const jodel_ids = result.rows.map(j => j.post_id);
    commentScraper.scrape(jodel_ids, false);
  } catch (e) {
    console.error(e);
    await setTimeout(() => {}, 5000)
    return triggerComments();
  }
}

async function commentHandler(jodel_ids, results) {
  try {
    const comments = [];
    results.forEach(jodel => {
      jodel.children.forEach(comment => {
        comments.push({
          post_id: comment.post_id,
          data: comment,
          parent: jodel.post_id,
          processed: true,
          location: jodel.location
        });
      });
    });
    // insert comments
    await knex('jodels').insert(comments);
    // update parent jodel
    await knex('jodels').update({processed: true}).whereIn('post_id', jodel_ids);
    // explicit sleep to make rate-limiting less probable
    await setTimeout(() => {}, 2000);
    triggerComments();
  } catch (e) {
    console.error(e);
  }
}

