CREATE TABLE public.innocent_probe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text,
  created_at timestamp NOT NULL DEFAULT now()
);
