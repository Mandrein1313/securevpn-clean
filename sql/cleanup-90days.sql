-- ลบ connection log ที่เก่ากว่า 90 วัน (รันมือหรือตั้ง cron)
-- หมายเหตุ: คอลัมน์ในตารางเราใช้ started_at เป็น bigint (unix ms)

delete from conn_logs
where coalesce(ended_at, started_at, created_at) < (extract(epoch from now()) * 1000 - 90::bigint * 24 * 60 * 60 * 1000);

-- ถ้าต้องการใช้ pg_cron (ต้องเปิด extension ใน Database → Extensions)
-- create extension if not exists pg_cron;
-- select cron.schedule(
--   'purge-conn-logs-90d',
--   '0 3 * * *',
--   $$delete from conn_logs where coalesce(ended_at, started_at, created_at) < (extract(epoch from now()) * 1000 - 90::bigint * 24 * 60 * 60 * 1000)$$
-- );
