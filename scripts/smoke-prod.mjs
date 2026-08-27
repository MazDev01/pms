// ตรวจเว็บใช้งานจริงด้วยเบราว์เซอร์จริง (ใช้หลังอัปโค้ดขึ้นทุกครั้ง)
//   npm run smoke:prod
// ต้องมีบัญชีตรวจใน tests/.env.prod หรือ env: PROD_ADMIN_EMAIL / PROD_ADMIN_PASSWORD
//                                            PROD_DEALER_EMAIL / PROD_DEALER_PASSWORD
// เปลี่ยนที่อยู่เว็บ: PROD_HQ_URL / PROD_DEALER_URL
import { spawn } from "node:child_process";
const child = spawn("npx", ["playwright", "test", "-c", "playwright.prod.config.ts", ...process.argv.slice(2)], {
  stdio: "inherit", shell: true,
});
child.on("exit", c => process.exit(c ?? 1));
