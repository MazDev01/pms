import { AuthGuard } from "@/components/layout/AuthGuard";
import { AppShell } from "@/components/layout/AppShell";
import { FilterProvider } from "@/context/FilterContext";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <FilterProvider>
        <AppShell>{children}</AppShell>
      </FilterProvider>
    </AuthGuard>
  );
}
