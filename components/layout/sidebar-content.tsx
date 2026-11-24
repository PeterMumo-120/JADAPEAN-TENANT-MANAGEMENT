"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, Home } from "lucide-react";
import { initials } from "@/lib/format";
import { manageNav, workspaceNav, type NavItem } from "@/components/layout/nav-config";
import { UserMenu } from "@/components/layout/user-menu";

export type ShellAdmin = { firstName: string; lastName: string; phone: string };
export type ShellCounts = { pendingAdmins: number; unmatchedPayments: number };

export function SidebarContent({ admin, counts, phoneLabel, onNavigate, collapsed = false }: {
  admin: ShellAdmin; counts: ShellCounts; phoneLabel: string; onNavigate?: () => void; collapsed?: boolean;
}) {
  const pathname = usePathname();
  const link = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/") || (item.href === "/settings" && pathname.startsWith("/shortcodes"));
    const badge = item.badge ? counts[item.badge] : 0;
    return (
      <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} aria-label={collapsed ? item.label : undefined}
        title={collapsed ? item.label : undefined} className={`nav-item ${collapsed ? "nav-item-collapsed" : ""} ${active ? "nav-item-active" : ""}`}>
        <item.icon className="size-[17px]" strokeWidth={1.8} />
        {!collapsed && <span>{item.label}</span>}
        {badge > 0 && (collapsed
          ? <span className="absolute right-2 top-1.5 size-2 rounded-full bg-[#8fc09b]" aria-label={`${badge} waiting`} />
          : <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">{badge}</span>)}
      </Link>
    );
  };

  // Brand and user stay pinned; the navigation in the middle scrolls vertically whenever it is taller than the screen.
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className={`flex h-[82px] shrink-0 items-center ${collapsed ? "justify-center" : "gap-3 px-7"}`}>
        <div className="brand-mark"><Home className="size-5" strokeWidth={2.2} /></div>
        {!collapsed && (
          <div>
            <div className="font-display text-[21px] font-semibold tracking-tight">rentify<span className="text-[#8fc09b]">.</span></div>
            <div className="text-xs font-medium tracking-wide text-white/60">Property management</div>
          </div>
        )}
      </div>

      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain pb-4">
        <div className={collapsed ? "px-3 pt-4" : "px-4 pt-5"}>
          {!collapsed && <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-white/55">Workspace</p>}
          <nav className="flex flex-col gap-1" aria-label="Main navigation">{workspaceNav.map(link)}</nav>
        </div>
        <div className={collapsed ? "px-3 pt-3" : "px-4 pt-8"}>
          {collapsed ? <div className="mx-2 mb-3 h-px bg-white/10" /> : <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-white/55">Manage</p>}
          <nav className="flex flex-col gap-1" aria-label="Manage">{manageNav.map(link)}</nav>
        </div>
      </div>

      <div className={`shrink-0 border-t border-white/10 ${collapsed ? "flex justify-center p-3" : "p-4"}`}>
        {collapsed ? (
          <UserMenu name={`${admin.firstName} ${admin.lastName}`} phone={phoneLabel} className="rounded-full hover:bg-white/10">
            <span className="avatar-initials size-9 bg-white/15 text-white">{initials(admin.firstName, admin.lastName)}</span>
          </UserMenu>
        ) : (
          <div className="flex items-center gap-3 rounded-lg px-2 py-1">
            <div className="avatar-initials size-9 bg-white/15 text-white">{initials(admin.firstName, admin.lastName)}</div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-white/90">{admin.firstName} {admin.lastName}</div>
              <div className="mt-0.5 text-xs text-white/60">Admin</div>
            </div>
            <UserMenu name={`${admin.firstName} ${admin.lastName}`} phone={phoneLabel} className="rounded-md p-1 hover:bg-white/10">
              <Ellipsis className="size-[18px] text-white/65" />
            </UserMenu>
          </div>
        )}
      </div>
    </div>
  );
}
