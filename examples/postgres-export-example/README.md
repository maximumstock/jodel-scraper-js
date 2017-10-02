# postgres-export-example

A simple example project that shows how scraping and 
storing the collected Jodels could work with Postgres.

## How To

Executing `./start.sh` starts some scrapers, whose
scraped Jodels are stored in a Postgres database.

The database credentials can be configured via the
environment variable `DB_CONNECTION`, which expects
a connection string like `postgres://jodel:jodel@localhost:5432/jodel-export-example`.
