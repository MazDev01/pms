-- Benjamin PMS — แก้ 0090: revoke ทีละคอลัมน์ไม่พอ ต้องถอด grant "ทั้งตาราง" ก่อน (31 ก.ค. 69)
--
-- ยืนยันด้วยการทดสอบจริง (ล็อกอินเป็นตัวแทน RYG แล้ว select * จากตาราง dealers ตรงๆ) พบว่า
-- revenue_target ยังโผล่มาอยู่ ทั้งที่ 0090 revoke select (revenue_target) ไปแล้ว — สาเหตุ: ไม่มี
-- migration ไหนเคยสั่ง "grant select on public.dealers to authenticated" ตรงๆ เลย (ค้นแล้วไม่เจอ) →
-- สิทธิ์อ่านทั้งตาราง (ทุกคอลัมน์) มาจาก default privilege ที่ Supabase ตั้งให้ตอนสร้างโปรเจกต์
-- (grant select ทั้งตารางให้ authenticated/anon อัตโนมัติ) ซึ่งกว้างกว่าและครอบคลุม column-level
-- revoke ของเราไปแล้ว — ต้องถอน grant ระดับตารางออกก่อน แล้วค่อยให้สิทธิ์เฉพาะคอลัมน์ที่ต้องการ

revoke select on public.dealers from authenticated;
grant select (code, name, province, region, status, created_at) on public.dealers to authenticated;
-- revenue_target ตั้งใจไม่อยู่ในลิสต์นี้ — อ่านได้ทางเดียวคือผ่าน dealers_directory (view, มาสก์ตาม is_hq()/auth_dealer())
