/**
 * ใส่ค่าจาก Supabase → Project Settings → API
 * ห้ามใส่ service_role key
 */
window.SUPABASE_URL = "https://inoiddbxkmzkzrjlzdhi.supabase.co";
window.SUPABASE_ANON_KEY = "PASTE_ANON_PUBLIC_KEY_HERE";

/** ช่องทางรับเงิน (หน้า topup) */
window.SVPN_PAY = {
  phone: "096-000-0000",
  name: "ชื่อบัญชีรับเงิน (แก้ใน config.js)"
};
