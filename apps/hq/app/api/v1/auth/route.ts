// เส้นทาง /api/v1/auth — handler จริงอยู่ในแพ็กเกจกลาง
export { GET, POST } from "@pms/shared/server/v1/auth";

// ⚠️ ต้องประกาศตรงนี้เป็นค่าตัวอักษร ห้าม re-export มาจากไฟล์กลาง
export const runtime = "nodejs";
