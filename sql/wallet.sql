-- SecureVPN Wallet / Credit system (ขั้น 1)
create table if not exists wallets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(12,2) not null default 0 check (balance >= 0),
  updated_at timestamptz default now()
);

create table if not exists topups (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(12,2) not null check (amount > 0),
  method text not null default 'bank',
  ref_code text default '',
  note text default '',
  status text not null default 'pending',
  admin_note text default '',
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists topups_user_id_idx on topups (user_id);
create index if not exists topups_status_idx on topups (status);

create table if not exists purchases (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan_code text not null,
  plan_label text not null default '',
  price numeric(12,2) not null check (price >= 0),
  status text not null default 'paid',
  vpn_user text default '',
  vpn_pass text default '',
  server_label text default '',
  note text default '',
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);
create index if not exists purchases_user_id_idx on purchases (user_id);

alter table wallets enable row level security;
alter table topups enable row level security;
alter table purchases enable row level security;

drop policy if exists "wallets_select_own" on wallets;
drop policy if exists "wallets_admin_all" on wallets;
drop policy if exists "wallets_insert_own" on wallets;
drop policy if exists "wallets_update_own" on wallets;
drop policy if exists "topups_select_own" on topups;
drop policy if exists "topups_insert_own" on topups;
drop policy if exists "topups_admin_all" on topups;
drop policy if exists "purchases_select_own" on purchases;
drop policy if exists "purchases_insert_own" on purchases;
drop policy if exists "purchases_admin_all" on purchases;

create policy "wallets_select_own" on wallets for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "wallets_insert_own" on wallets for insert to authenticated
  with check (user_id = auth.uid());
create policy "wallets_update_own" on wallets for update to authenticated
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
create policy "wallets_admin_all" on wallets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "topups_select_own" on topups for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "topups_insert_own" on topups for insert to authenticated
  with check (user_id = auth.uid());
create policy "topups_admin_all" on topups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "purchases_select_own" on purchases for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy "purchases_insert_own" on purchases for insert to authenticated
  with check (user_id = auth.uid());
create policy "purchases_admin_all" on purchases for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
