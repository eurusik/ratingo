CREATE TABLE public.opaque_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid,
  topic varchar(200),
  extra jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
