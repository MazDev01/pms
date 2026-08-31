-- ── ถังเก็บไฟล์แบบแปลนของแม่แบบ (บอสสั่ง 28 ส.ค. 69) ────────────────────────────
--
-- ทำไมไม่ใช้ถัง catalog-images ที่มีอยู่แล้ว:
--   0097 ล็อก catalog-images ไว้เป็น "รูปภาพล้วน" (image/jpeg,png,webp · 10 MB) โดยตั้งใจ
--   เพราะถังนั้นอ่านสาธารณะและมีไว้ใส่รูปแม่แบบเท่านั้น — ชนิดไฟล์จึงแน่นอน ล็อกได้เข้ม
--   แบบแปลนเป็น PDF/DWG/DXF ถ้าจะยัดลงถังเดิมต้องปลดล็อกชนิดไฟล์ของรูปไปด้วย
--   = ทำให้เกราะที่ 0097 ตั้งใจใส่ไว้อ่อนลงทั้งถัง เพื่อของที่ไม่เกี่ยวกัน
--
-- ถังใหม่จึงคุมของตัวเอง: 25 MB (เท่าไฟล์แนบของตัวแทน ผู้ใช้จะได้ไม่ต้องจำสองตัวเลข)
--
-- ⚠️ ไม่ล็อก allowed_mime_types — เหตุผลเดียวกับ dealer-files ที่ 0097 เขียนไว้:
--    ไฟล์ CAD (.dwg/.dxf) ไม่มี MIME มาตรฐานที่เบราว์เซอร์รายงานตรงกัน (มักได้ application/octet-stream)
--    ล็อกแล้วจะบล็อกไฟล์ที่ถูกต้องเพราะ MIME เพี้ยน · ความเสี่ยงจริงคือเปลืองพื้นที่ ซึ่งคุมด้วยขนาดไฟล์แล้ว
--
-- สิทธิ์: อ่านสาธารณะ (ตัวแทนทุกสาขาต้องเปิดดูได้ · แบบแปลนเป็นเอกสารที่ใช้คุยกับลูกค้าอยู่แล้ว)
--         เขียนเฉพาะสำนักงานใหญ่ — แบบเดียวกับ catalog-images (0010)

insert into storage.buckets (id, name, public, file_size_limit)
values ('catalog-plans', 'catalog-plans', true, 26214400)
on conflict (id) do update set public = true, file_size_limit = 26214400;

drop policy if exists catalog_plans_read  on storage.objects;
drop policy if exists catalog_plans_write on storage.objects;
create policy catalog_plans_read on storage.objects for select
  using ( bucket_id = 'catalog-plans' );
create policy catalog_plans_write on storage.objects for all
  using ( bucket_id = 'catalog-plans' and is_hq() )
  with check ( bucket_id = 'catalog-plans' and is_hq() );
