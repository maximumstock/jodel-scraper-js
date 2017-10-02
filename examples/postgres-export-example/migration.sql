CREATE TABLE IF NOT EXISTS jodels (
  post_id text PRIMARY KEY,
  data jsonb not null,
  location jsonb not null,
  created_at timestamp DEFAULT NOW()
);
