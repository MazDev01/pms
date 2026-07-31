-- Benjamin PMS — Phase 6: Security Audit (Enterprise Production Readiness Mission, 31 ก.ค. 69)
--
-- ช่องโหว่ที่ยืนยันจริง: storage.buckets ทั้ง 3 (dealer-files/catalog-images/avatars) ไม่มี
-- file_size_limit / allowed_mime_types เลยตั้งแต่สร้าง (0010) — ขนาดไฟล์ 25MB ที่หน้า /files บังคับ
-- (MAX_UPLOAD_BYTES) และรายการนามสกุลที่ /customers บังคับ (CUSTOMER_FILE_ACCEPTED_EXT) เป็นแค่เช็ก
-- ฝั่ง client เท่านั้น — บัญชีตัวแทนจริง (มี JWT ถูกต้อง) ยิง Storage API ตรงข้าม client ได้ อัปโหลด
-- ไฟล์ใหญ่แค่ไหน/ชนิดไหนก็ได้ ตราบใดที่ path ยังอยู่ในโฟลเดอร์สาขาตัวเอง (RLS policy เช็กแค่นั้นจริง)
-- ความเสี่ยง: เปลืองพื้นที่จัดเก็บ (storage-abuse) ไม่ใช่ปล่อยข้อมูลรั่ว — ใส่ backstop ฝั่ง server ให้ตรง
-- กับที่ client ตั้งใจไว้อยู่แล้ว (ไม่ได้ตั้งเข้มกว่าของเดิม กัน false-positive กับของที่ใช้งานจริงอยู่)
--
-- dwg/dxf (CAD) ไม่มี MIME type มาตรฐานที่เบราว์เซอร์รายงานตรงกันทุกตัว (มักได้ application/octet-stream)
-- จึงไม่ล็อก allowed_mime_types ของ dealer-files ให้เข้มกว่านี้ (เสี่ยงบล็อกไฟล์ถูกต้องเพราะ MIME ผิด)
-- — คุมด้วย file_size_limit เป็นหลัก (ปิดความเสี่ยง storage-abuse ที่เป็นเรื่องจริง) ส่วน
-- catalog-images/avatars เป็นรูปภาพล้วน MIME แน่นอน จึงล็อกได้ทั้งขนาดและชนิดไฟล์

update storage.buckets set file_size_limit = 26214400 -- 25 MB ตรงกับ MAX_UPLOAD_BYTES (apps/dealer/files/page.tsx)
  where id = 'dealer-files';

update storage.buckets set
  file_size_limit = 5242880, -- 5 MB — รูปโปรไฟล์ไม่ควรใหญ่กว่านี้
  allowed_mime_types = array['image/jpeg','image/png','image/webp','image/gif']
  where id = 'avatars';

update storage.buckets set
  file_size_limit = 10485760, -- 10 MB — รูปแม่แบบ/แคตตาล็อก
  allowed_mime_types = array['image/jpeg','image/png','image/webp']
  where id = 'catalog-images';
