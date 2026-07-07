import { AuthGuard } from "@/components/layout/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {/* FilterProvider ถูกครอบต่อหน้าใน AppShell (แยกอิสระต่อ route) */}
      <AppShell>{children}</AppShell>
    </AuthGuard>
  );
}
