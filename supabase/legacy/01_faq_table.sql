-- ============================================
-- FAQS (run AFTER the main schema from Part A)
-- ============================================
create table public.faqs (
  id uuid primary key default uuid_generate_v4(),
  question text not null,
  answer text not null,
  display_order smallint default 0,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_faqs_active on public.faqs(is_active, display_order);

-- RLS
alter table public.faqs enable row level security;

create policy "faqs_public_read_active" on public.faqs
  for select using (is_active = true);

create policy "faqs_admin_all" on public.faqs
  for all using (public.get_user_role() in ('devcom_head', 'comm_content'));
