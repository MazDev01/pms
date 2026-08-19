-- ── จำกัดจำนวนคำขอของ "ตัวเอง" โดยไม่ต้องใช้กุญแจระดับระบบ ──────────────────────
--
-- ที่มา: ผลตรวจระบบ 19 ส.ค. 69 พบว่าเส้นทางงานขาย (/api/v1/*) ไม่มีด่านจำกัดคำขอเลย
--   มีเฉพาะเส้นทางผู้ดูแล บัญชีตัวแทนที่ถูกขโมยจึงดูดข้อมูลทั้งสาขาออกไปได้เร็วมาก
--
-- ทำไมไม่ใช้ check_rate_limit เดิม (0065):
--   ตัวนั้นเรียกได้เฉพาะ service_role และรับ key เป็นพารามิเตอร์
--   แอปตัวแทนไม่มีกุญแจระดับระบบ (และไม่ควรมี — ถ้าค่านั้นรั่วคือคุมได้ทั้งฐานข้อมูล)
--   ส่วนการเปิดตัวเดิมให้ผู้ใช้ทั่วไปเรียกก็ไม่ได้ เพราะส่ง key เป็นของคนอื่นได้
--   = ยิงให้คนอื่นเต็มโควตาแทนเราได้ กลายเป็นช่องโจมตีเสียเอง
--
-- ใบนี้จึงแยกฟังก์ชันใหม่: ผู้ใช้ที่ล็อกอินแล้วเรียกเองได้ แต่ "ห้ามเลือกว่าจะนับให้ใคร"
--   คีย์ประกอบจาก auth.uid() ภายในฟังก์ชัน — ปลอมเป็นบัญชีอื่นไม่ได้
--   p_scope บอกได้แค่ว่านับถังไหน (อ่าน/เขียน) ไม่ใช่ตัวตน
create or replace function public.check_own_rate_limit(
  p_scope text, p_max integer, p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  k   text;
  rec rate_limits;
begin
  -- ไม่มีตัวตน = ปล่อยผ่าน (ด่านชั้นอื่นปฏิเสธอยู่แล้ว — ที่นี่ไม่มีอะไรให้นับ)
  if auth.uid() is null then return true; end if;
  -- อนุญาตเฉพาะชื่อถังที่รู้จัก กันคนยัดค่าประหลาดจนตารางบวม
  if p_scope not in ('read', 'write') then return true; end if;

  k := 'v1:' || p_scope || ':' || auth.uid()::text;

  insert into rate_limits(key, window_start, count)
    values (k, now(), 0)
    on conflict (key) do nothing;

  select * into rec from rate_limits where key = k for update;   -- ล็อกกันแข่ง

  if rec.window_start < now() - make_interval(secs => p_window_seconds) then
    update rate_limits set window_start = now(), count = 1 where key = k;   -- เริ่มหน้าต่างใหม่
    return true;
  end if;

  if rec.count >= p_max then
    return false;   -- เกินโควตาในหน้าต่างนี้
  end if;

  update rate_limits set count = count + 1 where key = k;
  return true;
end $$;

revoke all     on function public.check_own_rate_limit(text, integer, integer) from public, anon;
grant  execute on function public.check_own_rate_limit(text, integer, integer) to authenticated;

comment on function public.check_own_rate_limit(text, integer, integer) is
  'นับโควตาคำขอของผู้เรียกเอง (คีย์มาจาก auth.uid() ปลอมเป็นคนอื่นไม่ได้) — คืน false เมื่อเกินโควตา';
