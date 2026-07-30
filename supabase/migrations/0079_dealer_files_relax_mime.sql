-- แก้ regression จาก 0075: allowed_mime_types ที่ bucket dealer-files เข้มเกินไป —
--   bucket นี้ใช้ร่วมกัน 2 จุดที่ตั้งใจให้ต่างขอบเขตกัน:
--     • หน้าคลังไฟล์ (files/page.tsx) ตั้งใจจำกัดชนิด (PDF/Word/Excel/CAD/รูปภาพ) — มี accept= + เช็กที่ client แล้ว (0075)
--     • ช่องแนบไฟล์ที่ลิ้นชักลีด (input[type=file] ไม่มี accept=) — ตั้งใจให้แนบได้ทุกชนิดไฟล์ ไม่จำกัด
--   allowed_mime_types ที่ 0075 ตั้งเป็น bucket-level จึงบังคับทั้งบัคเก็ต รวมถึงช่องที่ตั้งใจไม่จำกัดด้วย
--   → ไฟล์ .txt/text-plain (และชนิดอื่นที่ไม่อยู่ในลิสต์) อัปโหลดที่ลิ้นชักลีดไม่ได้เลย ทั้งที่ควรได้
--   (พบจาก regression suite หลังแก้ — func-appt-files.spec.ts "แนบไฟล์ที่ลีด" ล้มเหลวคงที่)
--
-- แก้: ปลด allowed_mime_types ที่ bucket กลับเป็นไม่จำกัด (เกราะหลักคือ client ที่หน้าคลังไฟล์อยู่แล้ว)
--   คง file_size_limit ไว้ (ไม่ขัดกับการใช้งานจริงจุดไหนเลย ปลอดภัยเก็บไว้)
update storage.buckets
set allowed_mime_types = null
where id = 'dealer-files';
