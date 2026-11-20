-- ============================================================
-- SecureVPN: RLS + สิทธิ์แอดมิน (รันใน SQL Editor)
-- ============================================================
-- ก่อนรัน: สมัคร user แอดมินที่ Authentication → Users → Add user
-- (Email + Password) แล้วคัดลอก UUID ของ user นั้นมาใส่ด้านล่าง

-- 1) ใส่ UUID แอดมินของคุณตรงนี้ (จาก Authentication → Users)
-- ตัวอย่าง: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
-- ถ้ายังไม่มี user ให้สร้างก่อน แล้วค่อยรันบล็อกนี้

-- ตารางโปรไฟล์แอดมิน (optional แต่อ่านง่าย)
create table if not exists admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  created_at timestamptz default now()
);

-- เปิด RLS ทุกตารางธุรกิจ
alter table orders enable row level security;
alter table conn_logs enable row level security;
alter table abuse_reports enable row level security;
alter table admin_users enable row level security;

-- ลบนโยบาย dev แบบเปิดกว้าง (ถ้ามี)
drop policy if exists "dev_all_orders" on orders;
drop policy if exists "dev_all_logs" on conn_logs;
drop policy if exists "dev_all_abuse" on abuse_reports;

drop policy if exists "orders_public_insert" on orders;
drop policy if exists "orders_admin_all" on orders;
drop policy if exists "orders_admin_select" on orders;
drop policy if exists "orders_admin_update" on orders;
drop policy if exists "orders_admin_delete" on orders;

drop policy if exists "logs_admin_all" on conn_logs;
drop policy if exists "abuse_admin_all" on abuse_reports;
drop policy if exists "admin_users_self" on admin_users;

-- ฟังก์ชันเช็คว่าเป็นแอดมินหรือไม่
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.admin_users au where au.user_id = auth.uid()
  );
$$;

-- ===== orders =====
-- ลูกค้า (anon / ไม่ล็อกอิน): เพิ่มออเดอร์ได้อย่างเดียว
create policy "orders_public_insert"
  on orders for insert
  to anon, authenticated
  with check (true);

-- แอดมิน: อ่าน แก้ ลบ ได้ทั้งหมด
create policy "orders_admin_select"
  on orders for select
  to authenticated
  using (public.is_admin());

create policy "orders_admin_update"
  on orders for update
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "orders_admin_delete"
  on orders for delete
  to authenticated
  using (public.is_admin());

-- ===== conn_logs: เฉพาะแอดมิน =====
create policy "logs_admin_all"
  on conn_logs for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== abuse_reports: เฉพาะแอดมิน =====
create policy "abuse_admin_all"
  on abuse_reports for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- ===== admin_users: แอดมินเห็นรายการตัวเอง =====
create policy "admin_users_self"
  on admin_users for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ------------------------------------------------------------
-- หลังจากสร้าง user ใน Authentication แล้ว รันคำสั่งนี้
-- แทนที่ UUID และอีเมลให้ตรงของคุณ:
-- ------------------------------------------------------------
-- insert into admin_users (user_id, email)
-- values ('PASTE-ADMIN-USER-UUID-HERE', 'you@email.com')
-- on conflict (user_id) do update set email = excluded.email;
