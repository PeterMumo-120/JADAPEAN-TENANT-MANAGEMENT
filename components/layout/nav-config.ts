import { Building2, LayoutDashboard, Settings2, ShieldCheck, Users, Wallet, type LucideIcon } from "lucide-react";

export type NavItem = { label: string; href: string; icon: LucideIcon; badge?: "pendingAdmins" | "unmatchedPayments" };

export const workspaceNav: NavItem[] = [
  { label: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { label: "Buildings", href: "/buildings", icon: Building2 },
  { label: "Tenants", href: "/tenants", icon: Users },
  { label: "Payments", href: "/payments", icon: Wallet, badge: "unmatchedPayments" },
];

export const manageNav: NavItem[] = [
  { label: "Admins", href: "/admins", icon: ShieldCheck, badge: "pendingAdmins" },
  { label: "Settings", href: "/settings", icon: Settings2 },
];

export function sectionLabel(pathname: string): string {
  const all = [...workspaceNav, ...manageNav];
  return all.find((i) => pathname === i.href || pathname.startsWith(i.href + "/"))?.label ?? "Workspace";
}
