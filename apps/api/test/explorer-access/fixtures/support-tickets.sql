CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  message text,
  contact_name text,
  created_at timestamp NOT NULL DEFAULT now()
);
