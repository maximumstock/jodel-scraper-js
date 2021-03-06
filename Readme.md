# jodel-scraper-js

A scraper project for the official Jodel™ application built with Node.js.

This project assumes that you have successfully obtained a valid
HMAC signing key and or an already registered `device_uid` for
each scraper you start.

If you do not know what this is about, please refer to Christian Fibich's 
[OJOC](https://bitbucket.org/cfib90/ojoc) project.
Authorization can only be assured by datamining an internal signing key
that is used for header signing (for calculating a 
[HMAC](https://en.wikipedia.org/wiki/Hash-based_message_authentication_code),
to be precise). OJOC somewhat explains how everything is tied together
and how said signing key can be obtained. With said signing key, `device_uid`s
(basically random SHA256 hashes) can be used for requesting an API token.

## Contents
- `lib/scraper.js` - an ES6 class implementing a dynamic scraper that automatically regulates scraping intervals based on last results
- `lib/api.js` - a small client implementation for authorization and fetching
Jodels and feeds from the official API
- `lib/locations.js` - a collection of big German cities and their geocoordinates
- `examples/file-export-example.js` - an example on how to use the scraper
- `examples/postgres-export-example` - an example on how to use the scraper with PostgreSQL
exports the collected Jodels to a JSON file
- `tests` - contains some code snippets to test API and code functionality

## Quickstart
Instantiate a new scraper instance via:

```js
const scraperConfig = {
  // starting interval [s]
  interval: 60,
  // minimum overlap threshold
  min_overlap: 3,
  // maximum overlap threshold
  max_overlap: 10,
  // seconds to decrease/increase interval
  // when min_overlap/max_overlap is crossed,
  // respectively
  min_overlap_step: 5,
  max_overlap_step: 5,
  // seconds to wait after initial cralwer start
  windup_delay: 0
}
const scraper = new DynamicScraper(device_uid, locationConfig, ?scraperConfig)	
```

A description of the constructor parameters can be found in the constructor section of `lib/scraper.js`.

Subscribe functions as event handlers to the scraper, which will get called upon successful Jodel collection. Each handler gets passed the collected Jodels as an array and the scraper itself with all its internal properties at that point in time.

```js
const handler = function(data, scraper) {
	// handle data
	console.log(`Found ${data.length} Jodels for ${scraper.location.name}`)
	// ...
}
	
scraper.subscribe(handler);
```

Start the actual scraping process via:

```js
scraper.start();
```
	
Stop the scraper at the next scraping tick via:

```js
scraper.stop();
```

Manually invoke scraping after `seconds` via:

```js
scraper.reschedule(seconds);
```
	
Manually request a new token via:

```js
scraper.authorize()
  .then(function() {
    // The instance now has a new access token
  })
  .catch(function(error) {
    // Some error occured
  });
```

## Features
- Scrape all Jodels (via feeds `discussed`, `popular` or `recent`) for a given location
- Supports dynamic interval configuration

## Examples
- see `lib/scraper.js` for an explanation of configurable parameters
- see `examples/file-export-example.js` for a simple usage example

## Notice
Jodel regularly deprecates old client versions.
Therefore client version in `config/index.js`, which is sent as a HTTP header with 
every request, needs to be updated regularly. The most recent version can be
found on the [Google Play Store](https://play.google.com/store/apps/details?id=com.tellm.android.app&hl=de)
page of the official Jodel application.

This also means that you need to update the HMAC signing key in `config/index.js`
from time to time.
