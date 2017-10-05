/**
 * @file An example for scraping locations and storing the data in a file
 * Look for a file called `exported_jodels.json` in the root directory for
 * the exported data.
 */

const DynamicScraper  = require('../lib/scraper');
const locations       = require('../lib/locations');
const device_uids     = require('../device_uids.json');
const fs              = require('fs');

// Grab a sample device_uid and location
const device_uid = device_uids[0];
const location = locations[0];

// Configure a scraper with the above details
const scraperConfig = {
  interval: 60,
  min_overlap: 5,
  max_overlap: 10,
  min_overlap_step: 6,
  max_overlap_step: 5
};

const scraper = new DynamicScraper(device_uid, location, scraperConfig);

// Add function handlers to process the collected data
// Each subscribed function gets passed the collected data and the instance
// of the scraper with all its state at that point in time
scraper.subscribe((data, scraper) => {
  console.log(`Collected ${data.length} Jodels for ${scraper.location.name}`);
  console.log('Storing Jodels to file...')
  // For simplicity just overwrite the file with every new batch
  fs.writeFileSync('exported_jodels.json', JSON.stringify(data), 'utf-8')
  console.log('Done');
});

// This starts the actual scraping process
scraper.start();
