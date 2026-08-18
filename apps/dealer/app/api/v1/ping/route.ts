// เส้นทาง /api/v1/ping — ตัว handler จริงอยู่ในแพ็กเกจกลาง (เขียนที่เดียว ใช้ทั้งสองแอป)
// ดูเหตุผลที่ packages/shared/server/v1/ping.ts
export { GET, runtime } from "@pms/shared/server/v1/ping";
