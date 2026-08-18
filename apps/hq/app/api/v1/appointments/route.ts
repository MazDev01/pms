// เส้นทาง /api/v1/appointments — handler จริงอยู่ในแพ็กเกจกลาง
export { apptGET as GET, apptPOST as POST, apptPUT as PUT, apptDELETE as DELETE } from "@pms/shared/server/v1/sales";

// ⚠️ ต้องประกาศตรงนี้เป็นค่าตัวอักษร ห้าม re-export มาจากไฟล์กลาง —
//    Next.js อ่านค่าพวกนี้จากตัวอักษรในไฟล์ route เท่านั้น re-export มาแล้วมันเตือนแล้วใช้ค่าเริ่มต้นแทน
export const runtime = "nodejs";
