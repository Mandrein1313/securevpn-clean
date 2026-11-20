-- ลูกค้า: ผูกออเดอร์กับ user_id
alter table orders add column if not exists user_id uuid references auth.users(id);
create index if not exists orders_user_id_idx on orders (user_id);

drop policy if exists "orders_customer_select_own" on orders;
create policy "orders_customer_select_own"
  on orders for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- insert อนุญาต authenticated (store จะอัปเดต user_id หลัง insert)
drop policy if exists "orders_public_insert" on orders;
drop policy if exists "orders_customer_insert" on orders;
create policy "orders_customer_insert"
  on orders for insert
  to authenticated
  with check (true);

-- ลูกค้าอัปเดต user_id ของแถวตัวเองได้ (หลัง insert)
drop policy if exists "orders_customer_update_own" on orders;
create policy "orders_customer_update_own"
  on orders for update
  to authenticated
  using (user_id is null or user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());
