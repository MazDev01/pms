// โครงโหลดระดับ (app) — ครอบหน้าที่ไม่ได้อยู่ใต้ /hq (เช่น /dashboard)
import { PageSkeleton } from "@pms/shared/components/ui/PageSkeleton";

export default function AppLoading() {
  return <PageSkeleton cards={4} rows={7} cols={5} />;
}
