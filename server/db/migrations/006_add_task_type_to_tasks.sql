ALTER TABLE tasks
ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'normal';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_tasks_task_type'
  ) THEN
    ALTER TABLE tasks
      ADD CONSTRAINT chk_tasks_task_type
      CHECK (task_type IN ('normal', 'eventful', 'continuous'));
  END IF;
END $$;
