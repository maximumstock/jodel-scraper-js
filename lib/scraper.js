/**
 * @file A scraper class
 */

const api = require('./api');
const logger = require('./logger');

class DynamicScraper {

  /**
   * Creates a new instance of DynamicScraper
   * @param {string} feed
   * @param {object} location - Object describing the target location with the
   * following structure:
   * 		{
   * 			lat: <number>,
   * 			lng: <number>,
   * 			?name: <string>, // optional
   * 			?country_code: <string>, // optional
   * 			?accuracy: <number> // optional
   * 		}
   * @param {object} options - Object with optional settings such as:
   * 		{
   * 			interval: <number>, // default: 60[s]
   * 			min_overlap: <number>,
   * 			min_overlap_step: <number>,
   * 			max_overlap: <number>,
   * 			max_overlap_step: <number>
   * 		}
   *
   * `interval` is the starting interval of the scraper in seconds.
   * `min_overlap` and `max_overlap` defines the range of total number of
   * Jodels that are allowed to be overlapping between different scrapes of
   * the same feed and location. `min_overlap_step` and `max_overlap_step`
   * describe how many seconds the interval should be decreased or increased,
   * respectively, when leaving that range of overlap.
   *
   * For example, the following configuration means:
   *
   * 		{
   * 			interval: 60,
   * 			min_overlap: 5,
   * 			max_overlap: 20,
   * 			min_overlap_step: 6,
   * 			max_overlap_step: 5
   * 		}
   *
   * 	- the scraper starts with an initial interval of 60s
   * 	- whenever the overlap between the last and the current scrape results is
   * 		smaller (<) than 5 Jodels, the interval is decreased by 6
   * 	- whenever the overlap ... is greater (>) than 20 Jodels, the interval is
   * 		increased by 5
   *
   */
  constructor(feed, location, options = {}) {

    this.feed = feed;
    // location details
    this.location = {
      latitude: location.latitude,
      longitude: location.longitude,
      name: location.name || '',
      country_code: location.country_code || 'DE',
      accuracy: location.accuracy ||  0
    };
    // see above for more details
    this.options = this.buildOptions(options);
    // `this.auth` will contain the full response body of an authorization
    // request, which looks something like:
    // { access_token: <string>, refresh_token: <string>, ...}
    // `access_token` being the actual token for future requests
    this.auth = null;
    // interal caching field to calculate the overlap between single feeds
    this._latest = null;
    // interval flag to signal the `scrape()` loop to stop asap
    this._stop = false;
    // list of functions to call with new feed data
    this._callbacks = [];
  }

  /**
   * Builds a configruation object containing all options and applies default
   * settings if parameters are missing
   * @param {object} options
   */
  buildOptions(options) {
    return {
      interval: options.interval || 60,
      min_overlap: options.min_overlap  ||  5,
      max_overlap: options.max_overlap || 10,
      min_overlap_step: options.min_overlap_step || 5,
      max_overlap_step: options.max_overlap_step || 5
    };
  }

  subscribe(callback) {
    this._callbacks.push(callback);
  }

  /**
   * Starts the scraper aka starts the first `scrape()` call
   */
  start() {
    const initial_delay = 0; // parseInt(Math.random() * 1000 % 10);
    setTimeout(() => {
      this.scrape();
    }, initial_delay * 1000);
  }

  /**
   * Stops the scraper aka sets an internal flag that stops the scraping loop
   * to restart the next time `scrape()` is executed
   */
  stop() {
    this._stop === true;
  }

  authorize() {
    return new Promise((resolve, reject) => {

      const self = this;

      function request_new_token() {
        logger.info(`${self.getDescription()}: requesting new token`);
        api.request_token(self.location.latitude, self.location.longitude,
            self.location.name, self.location.country_code, self.location.accuracy)
          .then(response => {
            self.auth = response.body;
            logger.info(`${self.getDescription()}: acquired new token`);
            return resolve();
          })
          .catch(error => {
            logger.error(`${self.getDescription()}: error when requesting token ${error}`)
          });
      }

      // authorizes/requests a new token when there was no authorization before
      // or the old token expired/is going to expire very soon
      try {
        const expiration_time = this.auth.expiration_date;
        const current_time = parseInt(new Date().getTime() / 1000);

        if (current_time + 5 > expiration_time) {
          return request_new_token();
        } else {
          return resolve();
        }
      } catch (e) {
        return request_new_token();
      }
    })
  }

  /**
   * Updates the interval of the scraper instance according to the thresholds
   * and delta values in `this.options`
   * @param {array} new_data
   */
  updateInterval(new_data) {
    const new_post_ids = new_data.map(p => p.post_id);
    const old_post_ids = this._latest.map(p => p.post_id);
    const overlap = new_post_ids.filter(id => old_post_ids.indexOf(id) > -1);
    const overlap_size = overlap.length;
    const old_interval = this.options.interval;

    if (overlap_size < this.options.min_overlap) {
      this.options.interval = old_interval - this.options.min_overlap_step;
    }
    if (overlap_size > this.options.max_overlap) {
      this.options.interval = old_interval + this.options.max_overlap_step;
    }
    if (this.options.interval < 0) {
      this.options.interval = 0;
    }

    logger.info(`${this.getDescription()}: update interval: ${old_interval}s -> ${this.options.interval}s`);
  }


  /**
   * Schedules the next invocation of `this.scrape()`
   * @param {number} delay
   */
  reschedule(delay) {
    const interval = delay ? delay : this.options.interval;
    setTimeout(() => {
      return this.scrape();
    }, interval * 1000);
  }

  /**
   * Function that actually does the work and calls everything else needed.
   * - authorizes
   * - fetches the current feed
   * - updates the interval
   * - reschedules itself
   */
  scrape() {
    if (this._stop === true) {
      logger.info(`${this.getDescription()}: stopping`);
      return;
    }

    logger.info(`${this.getDescription()}: scraping`);

    this.authorize()
      .then(() => {
        // at this point `this.auth` should be populated properly
        const options = {
          lat: this.location.latitude,
          lng: this.location.longitude
        }
        return api.get_feed(this.auth.access_token, this.feed, options);
      })
      .then(feed => {
        if (this._latest !== null) {
          this.updateInterval(feed);
        }
        this._latest = feed;
        this._callbacks.forEach(cb => {
          cb(feed);
        });

        this.reschedule();
      })
      .catch(error => {
        logger.error(error);
        // Retry after 5 seconds
        this.reschedule(5);
      })

  }

  /**
   * Helper method to get a short textual description of the scraper's metadata
   */
  getDescription() {
    return `${this.location.name || ''}/${this.feed} - ${this.location.latitude}, ${this.location.longitude}`;
  }

  /**
   * For debugging purposes
   */
  toString() {
    return {
      feed: this.feed,
      location: this.location,
      options: this.options,
      latest: this._latest,
      callbacks: this._callbacks
    }.toString();
  }
}

module.exports = DynamicScraper;
