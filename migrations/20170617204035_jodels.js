/**
 * @file The initial database migration file for this project. Each migration
 * exports one `up` and `down` function, which are called upon invoking
 * `knex migrate:latest` and `knex migrate:rollback` in the shell, respectively
 */

exports.up = function (knex, Promise) {

  return Promise.all([

    knex.schema.createTableIfNotExists('jodels', function (t) {
      t.bigIncrements('id').primary();
      // metadata for which the Jodel was acquired
      t.decimal('latitude', 8, 6);
      t.decimal('longitude', 8, 6);
      t.text('location');
      t.text('feed');
      t.timestamp('created_at');
      t.timestamp('updated_at');
      // actual Jodel data
      t.jsonb('data');
    })

  ]);

};

exports.down = function (knex, Promise) {

  return Promise.all([
    knex.schema.dropTableIfExists('jodels')
  ]);

};
