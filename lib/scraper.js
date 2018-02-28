/**
 * @file A scraper class
 */

const api = require('./api');

class DynamicScraper {

  /**
   * Creates a new instance of DynamicScraper
   * @param {string} device_uid - A registered device_uid (see `device_uids.json`)
   * @param {object} location - Object describing the target location with the
   * following structure:
   *    {
   *      latitude: <number>,
   *      longitude: <number>,
   *      ?name: <string>, // optional
   *      ?country_code: <string>, // optional
   *      ?accuracy: <number> // optional
   *    }
   * 
   * `latitude` and `longitude` being the geocoordinates of the target location 
   * to scrape for. `name`, `country_code` and `accuracy` are not required. 
   * `name` is used for logging/instance identification.
   * `country_code` and `accuracy` do not have any effect as of now, but are
   * still maintained as configurable options since the official application
   * still uses them.
   * 
   * @param {object} options - Object with optional settings such as:
   *    {
   *      interval: <number>, // default: 60[s]
   *      min_overlap: <number>, // default 5
   *      max_overlap: <number>, // default 10
   *      min_overlap_step: <number>, // default 5
   *      max_overlap_step: <number>, // default 5
   *      windup_delay: <number> // default 0
   *    }
   *
   * The following options are used to implement a dynamic scraping interval
   * based on the fetched data.
   * `interval` is the starting interval of the scraper in seconds.
   * `min_overlap` and `max_overlap` defines the range of total number of
   * Jodels that are allowed to be overlapping between different scrapes of
   * the same feed and location. 
   * `min_overlap_step` and `max_overlap_step`
   * describe how many seconds the interval should be decreased or increased,
   * respectively, when leaving that range of overlap.
   * `windup_delay` is a flat number of seconds that is waited before actually
   * starting to scrape after `start()` is called on a scraper instance.
   *
   * For example, the following configuration means:
   *
   *    {
   *      interval: 60,
   *      min_overlap: 5,
   *      max_overlap: 20,
   *      min_overlap_step: 6,
   *      max_overlap_step: 5,
   *      windup_delay: 0
   *    }
   *
   *  - upon the first call of `start()` on a scraper instance, the number of
   *    seconds specified via `windup_delay` is waited before scraping
   * 	- the scraper starts with an initial interval of 60s
   * 	- whenever the overlap between the last and the current scrape results is
   *    smaller (<) than 5 Jodels, the interval is decreased by 6s
   * 	- whenever the overlap ... is greater (>) than 20 Jodels, the interval is
   *    increased by 5s
   *
   */
  constructor(device_uid, location, options = {}) {

    this.device_uid = device_uid;
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
    // internal flag to signal the `scrape()` loop to stop asap
    this._stop = false;
    // list of functions to call with new feed data
    this._callbacks = [];
    // a reference to the last event registered via `setTimeout`
    this._lastTimer = null;
  }

  /**
   * Builds a configruation object containing all options and applies default
   * settings if parameters are missing
   * @param {object} options
   */
  buildOptions(options) {
    return {
      interval: options.interval || 60,
      min_overlap: options.min_overlap  ||  3,
      max_overlap: options.max_overlap || 10,
      min_overlap_step: options.min_overlap_step || 30,
      max_overlap_step: options.max_overlap_step || 30,
      windup_delay: options.windup_delay || 0
    };
  }

  subscribe(callback) {
    this._callbacks.push(callback);
  }

  /**
   * Starts the scraper aka starts the first `scrape()` call
   */
  start() {
    this._stop = false;
    // Stop another timeout event from being registered if there already is one
    if (!this._lastTimer) {
      // Wait specified amount of time when `start()` is called
      // Subsequent calls to `start()` will not get here, unless `stop()`
      // was called before to clear the timeout timer `this._lastTimer`
      const delay = this.options.windup_delay * 1000;
      this._lastTimer = setTimeout(() => {
        this.scrape();
      }, delay);
    }
  }

  /**
   * Stops the scraper aka sets an internal flag that stops the scraping loop
   * to restart the next time `scrape()` is executed
   */
  stop() {
    this._stop = true;
    // Clear the next timer event registered via `setTimeout`
    clearTimeout(this._lastTimer);
  }

  authorize() {
    return new Promise((resolve, reject) => {

      const self = this;

      function request_new_token() {
        console.log(`${self.getDescription()}: requesting new token`);
        api.request_token(self.device_uid, self.location.latitude, self.location.longitude,
            self.location.name, self.location.country_code, self.location.accuracy)
          .then(response => {
            self.auth = response.body;
            console.log(`${self.getDescription()}: acquired new token`);
            return resolve();
          })
          .catch(error => {
            console.error(`${self.getDescription()}: error when requesting token ${error}`)
            return reject(error);
          });
      }

      // authorizes/requests a new token if there was no authorization before
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

    console.log(`${this.getDescription()}: update interval: ${old_interval}s -> ${this.options.interval}s`);
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
   * - delegates data to subscribers
   * - reschedules itself
   */
  scrape() {
    if (this._stop === true) {
      console.log(`${this.getDescription()}: stopping`);
      return;
    }

    console.log(`${this.getDescription()}: scraping`);

    this.authorize()
      .then(() => {
        // at this point `this.auth` should be populated properly
        const options = {
          lat: this.location.latitude,
          lng: this.location.longitude
        };

        // request all three feeds to make sure we get all available Jodels for our location
        return Promise.all([
          api.get_feed(this.auth.access_token, 'recent', options),
          api.get_feed(this.auth.access_token, 'popular', options),
          api.get_feed(this.auth.access_token, 'discussed', options)
        ]);
      })
      .then(results => {
        // merge the data from all three feeds into one array of unique Jodels
        const allJodels = [].concat(results[0], results[1], results[2]);
        const uniqueJodels = [];
        allJodels.forEach(jodel => {
          const found = uniqueJodels.filter(uJodel => uJodel.post_id === jodel.post_id).length > 0;
          if(!found) {
            uniqueJodels.push(jodel);
          }
        });

        if (this._latest !== null) {
          this.updateInterval(uniqueJodels);
        }
        this._latest = uniqueJodels;
        this._callbacks.forEach(cb => {
          cb(uniqueJodels, this);
        });

        this.reschedule();
      })
      .catch(error => {
        console.error(`${this.getDescription()}: Encountered an error`);
        console.error(error);
        // Retry after <interval> seconds
        this.reschedule(this.options.interval);
      })

  }

  /**
   * Helper method to get a short textual description of the scraper's metadata
   */
  getDescription() {
    return `${this.location.name || 'Scraper'} - ${this.location.latitude}, ${this.location.longitude}`;
  }

  /**
   * For debugging purposes
   */
  toString() {
    return {
      location: this.location,
      options: this.options,
      latest: this._latest,
      callbacks: this._callbacks
    }.toString();
  }
}

module.exports = DynamicScraper;
