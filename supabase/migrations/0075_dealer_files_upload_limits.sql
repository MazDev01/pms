-- จำกัดชนิด/ขนาดไฟล์ที่ bucket dealer-files — เดิมไม่ได้ตั้งเลย (0010) รับได้ทุกชนิด/ทุกขนาด
--   ตรวจพบจากผลตรวจสอบระบบ 30 ก.ค. 69 (Medium): อัปโหลด .exe ผ่านหน้าจอตัวแทนได้ปกติ ทั้งที่ UI บอกรับ
--   แค่ PDF/Word/Excel/CAD/รูปภาพ — เป็นช่องโหว่เชิงกำกับดูแลเนื้อหา (content governance) ถ้าบัญชีตัวแทนถูกยึด
--
-- allowed_mime_types รวม application/octet-stream ด้วย เพราะไฟล์ CAD (.dwg/.dxf) ไม่มี MIME มาตรฐานที่
-- เบราว์เซอร์/OS ส่วนใหญ่รู้จัก มักถูกรายงานเป็น octet-stream เหมือนไฟล์ไม่รู้จักทั่วไป (รวมถึง .exe ที่ปิดบัง
-- นามสกุลได้) — เกราะหลักที่กันไฟล์แปลกปลอมจริง ๆ คือฝั่ง client (accept= + เช็กนามสกุลก่อนอัปโหลด ใน
-- files/page.tsx) ชั้นนี้เป็นเกราะสำรอง (ขนาดไฟล์ตรวจแน่นอน 100% · MIME ช่วยกันเฉพาะชนิดที่ระบุตัวได้ชัด)
update storage.buckets
set file_size_limit = 26214400, -- 25 MB
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'application/octet-stream' -- CAD (.dwg/.dxf) ส่วนใหญ่มาในชื่อนี้ · เกราะหลักคือฝั่ง client
    ]
where id = 'dealer-files';
