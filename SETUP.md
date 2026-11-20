# SecureVPN — โปรเจกต์ครบ (หน้าเว็บ + Auth + เครดิต)

## ไฟล์สำคัญ
- index.html — หน้าขาย
- login.html — ล็อกอินลูกค้า (ชื่อผู้ใช้+รหัส)
- dashboard.html — แดชบอร์ด + ยอดเครดิต
- topup.html / packages.html / history.html — เติมเงิน ซื้อแพ็ก ประวัติ
- account.html — ออเดอร์แบบเก่า (ยังใช้ได้)
- admin.html — หลังบ้านออเดอร์
- admin-topups.html — อนุมัติเติมเงิน + ส่งรหัส VPN จากเครดิต
- js/config.js — URL, anon key, เบอร์รับเงิน
- js/store.js + js/wallet-store.js
- sql/security-rls.sql, customer-auth.sql, wallet.sql

## ติดตั้งบนโปรเจกต์ว่าง
1. แตก zip นี้ทั้งโฟลเดอร์ขึ้น GitHub (อย่าใส่ app/ หรือ .gradle)
2. แก้ js/config.js ใส่ ANON KEY + เบอร์รับเงิน
3. Supabase รัน SQL ตามลำดับ (ถ้ายังไม่เคย):
   - security-rls.sql (หรือของเดิมที่มี admin_users แล้วข้ามได้)
   - customer-auth.sql (user_id บน orders)
   - wallet.sql (wallets, topups, purchases)
4. ปิด Confirm email ใน Authentication → Providers → Email
5. Site URL = GitHub Pages ของคุณ
6. Push แล้วเปิด login.html

## เส้นทางผู้ใช้
สมัคร/ล็อกอิน → dashboard → เติมเงิน → แอดมินอนุมัติ → ซื้อแพ็ก → ประวัติ
