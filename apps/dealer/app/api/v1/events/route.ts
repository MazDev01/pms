// เส้นทาง /api/v1/events — handler จริงอยู่ในแพ็กเกจกลาง
export { GET } from "@pms/shared/server/v1/events";

// ⚠️ ต้องประกาศตรงนี้เป็นค่าตัวอักษร ห้าม re-export มาจากไฟล์กลาง —
//    Next.js อ่านค่าพวกนี้จากตัวอักษรในไฟล์ route เท่านั้น re-export มาแล้วมันเตือนแล้วใช้ค่าเริ่มต้นแทน
export const runtime = "nodejs";
export const dynamic = "force-dynamic";   // สายที่ไหลตลอด ห้ามแคช
