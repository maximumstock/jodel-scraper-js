CREATE TABLE IF NOT EXISTS jodels (
  post_id text PRIMARY KEY,
  data jsonb not null,
  location jsonb not null,
  created_at timestamp DEFAULT NOW()
);

ALTER TABLE jodels ADD COLUMN processed boolean DEFAULT false;
ALTER TABLE jodels ADD COLUMN parent text DEFAULT null;
ALTER TABLE jodels ADD CONSTRAINT jodels_fkey_parent FOREIGN KEY(parent) REFERENCES jodels(post_id);
