CREATE DOMAIN public.short_text AS text;
CREATE TABLE public.domain_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES public.users (id),
  topic public.short_text,
  search tsvector,
  created_at timestamp NOT NULL DEFAULT now()
);
