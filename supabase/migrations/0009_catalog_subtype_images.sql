-- Benjamin PMS — เพิ่มคอลัมน์ subtype_images ให้ master_catalog (Phase 5)
-- SolutionProduct มี subtypeImages?: Record<string,string> (รูปรายแม่แบบย่อย · base64/หรือ path)
-- 0001 ยังไม่มีคอลัมน์นี้ → บันทึกแคตตาล็อกจากแอปจะ error ("column subtype_images does not exist")
alter table master_catalog add column if not exists subtype_images jsonb default '{}';
