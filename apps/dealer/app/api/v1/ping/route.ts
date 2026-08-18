// เส้นทาง /api/v1/ping — ตัว handler จริงอยู่ในแพ็กเกจกลาง (เขียนที่เดียว ใช้ทั้งสองแอป)
// ดูเหตุผลที่ packages/shared/server/v1/ping.ts
export { GET } from "@pms/shared/server/v1/ping";

// ⚠️ ต้องประกาศตรงนี้เป็นค่าตัวอักษร ห้าม re-export มาจากไฟล์กลาง —
//    Next.js อ่านค่าพวกนี้จากตัวอักษรในไฟล์ route เท่านั้น re-export มาแล้วมันเตือนแล้วใช้ค่าเริ่มต้นแทน
export const runtime = "nodejs";
