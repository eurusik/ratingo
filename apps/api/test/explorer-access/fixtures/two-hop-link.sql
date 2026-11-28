CREATE TABLE public.batch_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid REFERENCES public.import_batches (id),
  topic varchar(100),
  created_at timestamp NOT NULL DEFAULT now()
);
