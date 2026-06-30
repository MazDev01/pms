"use client";

import { useRole } from "@/context/RoleContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isLoggedIn, hydrated } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isLoggedIn) {
      router.replace("/login");
    }
  }, [isLoggedIn, hydrated, router]);

  // Hide content until hydration is done — prevents flash of wrong role/nav.
  // Must still render children (not null) so SSR static generation can find the page module.
  if (!hydrated || !isLoggedIn) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }
  return <>{children}</>;
}
