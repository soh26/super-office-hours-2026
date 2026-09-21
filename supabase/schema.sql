-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Create registrations table
create table if not exists public.registrations (
    id uuid primary key default uuid_generate_v4(),
    stripe_session_id text unique,
    stripe_customer_id text,
    full_name text not null,
    email text not null,
    company text not null,
    role text,
    tickets jsonb not null default '{}'::jsonb,
    total_amount integer not null,
    currency text not null default 'jpy',
    event_slug text not null default 'super-office-hours',
    payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'canceled')),
    questionnaire jsonb default '{}'::jsonb,
    metadata jsonb default '{}'::jsonb,
    user_agent text,
    referrer text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Indexes for fast query lookup
create index if not exists idx_registrations_email on public.registrations(email);
create index if not exists idx_registrations_stripe_session_id on public.registrations(stripe_session_id);
create index if not exists idx_registrations_event_status on public.registrations(event_slug, payment_status);

-- Automatic updated_at timestamp trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_registrations_updated_at on public.registrations;
create trigger trigger_registrations_updated_at
    before update on public.registrations
    for each row
    execute procedure public.handle_updated_at();

-- Enable Row Level Security (RLS)
alter table public.registrations enable row level security;

-- Policy: Allow service role (Cloudflare Functions backend) full access
-- No public anonymous access policies are granted to protect PII

-- ==========================================
-- Sponsors Table (Custom Sponsorship Links)
-- ==========================================
create table if not exists public.sponsors (
    id uuid primary key default uuid_generate_v4(),
    name text not null,
    slug text not null unique,
    amount integer not null,
    currency text not null default 'jpy',
    description text,
    contact_email text,
    status text not null default 'pending' check (status in ('pending', 'paid', 'canceled', 'expired')),
    stripe_session_id text unique,
    stripe_payment_intent text,
    paid_at timestamptz,
    paid_by_name text,
    paid_by_email text,
    metadata jsonb default '{}'::jsonb,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Indexes for fast sponsor lookup
create index if not exists idx_sponsors_slug on public.sponsors(slug);
create index if not exists idx_sponsors_status on public.sponsors(status);

-- Updated_at trigger for sponsors
drop trigger if exists trigger_sponsors_updated_at on public.sponsors;
create trigger trigger_sponsors_updated_at
    before update on public.sponsors
    for each row
    execute procedure public.handle_updated_at();

-- Enable RLS for sponsors table
alter table public.sponsors enable row level security;
