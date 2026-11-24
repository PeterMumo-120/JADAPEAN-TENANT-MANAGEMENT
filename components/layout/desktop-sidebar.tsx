"use client";

import { useSidebar } from "@/components/layout/shell-frame";
import { SidebarContent, type ShellAdmin, type ShellCounts } from "@/components/layout/sidebar-content";

/** The fixed sidebar on large screens. It follows the shared collapsed state. */
export function DesktopSidebar(props: { admin: ShellAdmin; counts: ShellCounts; phoneLabel: string }) {
  const { collapsed } = useSidebar();
  return <SidebarContent {...props} collapsed={collapsed} />;
}
