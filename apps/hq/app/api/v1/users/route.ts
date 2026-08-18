// เส้นทาง /api/v1/users — handler จริงอยู่ในแพ็กเกจกลาง
export { usersGET as GET,usersPUT as PUT } from "@pms/shared/server/v1/records";

// ⚠️ ต้องประกาศตรงนี้เป็นค่าตัวอักษร ห้าม re-export มาจากไฟล์กลาง —
//    Next.js อ่านค่าพวกนี้จากตัวอักษรในไฟล์ route เท่านั้น re-export มาแล้วมันเตือนแล้วใช้ค่าเริ่มต้นแทน
export const runtime = "nodejs";
