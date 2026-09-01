// ทางผ่านไปยัง /api/account/reveal ของสำนักงานใหญ่ (ขอเลขยืนยันทางอีเมล + ดูรหัสผ่านของตัวเอง)
export { revealPOST as POST } from "@pms/shared/server/v1/accountProxy";

// ⚠️ ต้องประกาศตรงนี้เป็นค่าตัวอักษร ห้าม re-export มาจากไฟล์กลาง
export const runtime = "nodejs";
