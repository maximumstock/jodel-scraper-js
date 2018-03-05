/**
 * @file A scraper class
 */

const DynamicScraper = require('./scraper');
const api = require('./api');
const logger = require('./logger');

class CommentScraper extends DynamicScraper {

  constructor(device_uid, fake_location) {
    super(device_uid, fake_location);
  }

  scrape(jodel_ids, reschedule = true) {
    if (this._stop === true) {
      logger.info(`${this.getDescription()}: stopping`);
      return;
    }

    this.authorize()
      .then(() => {
        return Promise.all(jodel_ids.map(jodel_id => this.get_single_jodel_wrapper(this.auth.access_token, jodel_id)));
      })
      .then(results => {
        const jodels = results.filter(res => !!res).map(res => res.body);
        this._callbacks.forEach(cb => {
          cb(jodel_ids, jodels);
        });
        if (reschedule) {
          this.reschedule(100);
        }
      })
      .catch(error => {
        throw error;
      });

  }

  getDescription() {
    return `Comment Scraper`;
  }

  get_single_jodel_wrapper(token, jodel_id) {
    return new Promise((resolve, reject) => {
      return api.get_single_jodel(token, jodel_id)
        .then(resolve)
        .catch(response => {
          if (response.status === 404) {
            return resolve(null);
          } else {
            return reject(response);
          }
        });
    });
  }
}

module.exports = CommentScraper;
