"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { startPresence } from "@/lib/presence";

// 管理者の画面(/admin)では、数えない。
export function PresenceBeacon() {
  const path = usePathname();
  const skip = path.startsWith("/admin");
  useEffect(() => (skip ? undefined : startPresence()), [skip]);
  return null;
}
