CREATE TABLE public.feedback_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid REFERENCES public.users (id),
  topic varchar(200),
  created_at timestamp NOT NULL DEFAULT now()
);
