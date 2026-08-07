-- ── กันไฟล์อันตรายที่ "ชั้นเก็บไฟล์" ไม่ใช่แค่ที่หน้าจอ ────────────────────────────
--
-- ช่องโหว่ที่ปิด (ผลตรวจสอบระบบ 7 ส.ค. 69 · M-1 · ยิงพิสูจน์แล้ว):
--   ล็อกอินเป็นตัวแทนแล้วยิงอัปโหลดตรงเข้าที่เก็บไฟล์ (ไม่ผ่านหน้าจอ) สำเร็จทั้ง 3 ไฟล์:
--     ZZAUDIT-evil.exe · ZZAUDIT-evil.html · ZZAUDIT-evil.svg   (ลบออกแล้วหลังทดสอบ)
--   การอัปโหลดข้ามไปโฟลเดอร์สาขาอื่นถูกกันไว้ถูกต้องแล้ว — ปัญหาอยู่ที่ "ชนิดไฟล์" ล้วน ๆ
--
-- ทำไมด่านเดิมไม่กัน:
--   1) การตรวจนามสกุลอยู่ฝั่งหน้าจออย่างเดียว (uploadLimits.ts) — ยิง API ตรงข้ามได้ทั้งหมด
--   2) 0075 ตั้ง allowed_mime_types ไว้ที่ถัง แต่ตรวจค่าจริงแล้วเป็น null — คำสั่งนั้นไม่เคยมีผล
--      (updated_at ของถังยังเท่ากับ created_at เป๊ะ = ไม่เคยถูกแก้เลยสักครั้ง)
--   3) ต่อให้มีผล ก็กันไม่ได้อยู่ดี เพราะรายการนั้นต้องใส่ application/octet-stream ไว้
--      เพื่อรองรับไฟล์ CAD (.dwg/.dxf ที่เบราว์เซอร์ไม่รู้จัก) — ซึ่ง .exe ก็อ้างชนิดนี้ได้เหมือนกัน
--
-- แก้: ตรวจ "นามสกุลไฟล์" ที่ชั้นฐานข้อมูล ให้ตรงกับกฎฝั่งหน้าจอเป๊ะ ๆ
--   นามสกุลปลอมไม่ได้ เพราะเป็นส่วนหนึ่งของชื่อไฟล์ที่ถูกบันทึกจริง (ต่างจาก MIME ที่ผู้ส่งกำหนดเองได้)
--   ⚠️ จำกัดเฉพาะถัง dealer-files — ถังรูปโปรไฟล์/แคตตาล็อกมีรายการชนิดไฟล์ของตัวเองอยู่แล้ว
create or replace function public.guard_dealer_file_ext()
returns trigger
language plpgsql
as $$
declare
  ext text;
begin
  if new.bucket_id <> 'dealer-files' then
    return new;
  end if;

  -- นามสกุลตัวพิมพ์เล็กพร้อมจุดนำหน้า · ไม่มีจุดในชื่อ = ไม่มีนามสกุล
  ext := lower(substring(new.name from '\.[^.\\/]+$'));

  if ext is null or ext not in (
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.dwg', '.dxf', '.jpg', '.jpeg', '.png'
  ) then
    raise exception 'ไม่รองรับไฟล์ชนิด "%" — รับเฉพาะ PDF, Word, Excel, PowerPoint, CAD, รูปภาพ',
      coalesce(ext, 'ไม่ทราบ')
      using errcode = 'check_violation';
  end if;

  return new;
end $$;

drop trigger if exists trg_dealer_file_ext on storage.objects;
create trigger trg_dealer_file_ext
  before insert or update of name on storage.objects
  for each row execute function public.guard_dealer_file_ext();
