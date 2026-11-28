CREATE TABLE public.reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  who uuid REFERENCES public.users (id),
  reaction varchar(100),
  created_at timestamp NOT NULL DEFAULT now()
);
