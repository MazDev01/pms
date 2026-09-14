// เส้นทาง /api/v1/prospects — handler จริงอยู่ในแพ็กเกจกลาง
export { prospectsGET as GET, prospectsPOST as POST, prospectsPUT as PUT, prospectsDELETE as DELETE } from "@pms/shared/server/v1/prospects";

// ⚠️ ต้องประกาศตรงนี้เป็นค่าตัวอักษร ห้าม re-export มาจากไฟล์กลาง —
//    Next.js อ่านค่าพวกนี้จากตัวอักษรในไฟล์ route เท่านั้น re-export มาแล้วมันเตือนแล้วใช้ค่าเริ่มต้นแทน
export const runtime = "nodejs";
