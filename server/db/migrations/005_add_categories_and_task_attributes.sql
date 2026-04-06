CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_global_name
  ON categories (LOWER(name))
  WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categories_user_name
  ON categories (user_id, LOWER(name))
  WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS task_categories (
  task_id UUID NOT NULL,
  category_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (task_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_task_categories_task_id ON task_categories(task_id);
CREATE INDEX IF NOT EXISTS idx_task_categories_category_id ON task_categories(category_id);

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS mood TEXT,
  ADD COLUMN IF NOT EXISTS intent TEXT,
  ADD COLUMN IF NOT EXISTS outcome TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tasks_mood'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT chk_tasks_mood
      CHECK (mood IS NULL OR mood IN (
        'energetic', 'happy', 'neutral', 'tired', 'stressed', 'depressed'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tasks_intent'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT chk_tasks_intent
      CHECK (intent IS NULL OR intent IN (
        'productive', 'maintenance', 'leisure', 'escapism', 'compulsive', 'harmful'
      ));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tasks_outcome'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT chk_tasks_outcome
      CHECK (outcome IS NULL OR outcome IN (
        'positive', 'neutral', 'negative'
      ));
  END IF;
END $$;
