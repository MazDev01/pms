"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/context/RoleContext";

export default function HQLayout({ children }: { children: React.ReactNode }) {
  const { isHQ, hydrated } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (hydrated && !isHQ) {
      router.replace("/dashboard");
    }
  }, [isHQ, hydrated, router]);

  return <>{children}</>;
}
