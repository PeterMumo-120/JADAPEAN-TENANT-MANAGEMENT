"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Ellipsis, Home } from "lucide-react";
import { initials } from "@/lib/format";
import { manageNav, workspaceNav, type NavItem } from "@/components/layout/nav-config";
import { UserMenu } from "@/components/layout/user-menu";

export type ShellAdmin = { firstName: string; lastName: string; phone: string };
export type ShellCounts = { pendingAdmins: number; unmatchedPayments: number };

export function SidebarContent({ admin, counts, paybill, phoneLabel, onNavigate }: {
  admin: ShellAdmin; counts: ShellCounts; paybill: string; phoneLabel: string; onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const link = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(item.href + "/");
    const badge = item.badge ? counts[item.badge] : 0;
    return (
      <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`nav-item ${active ? "nav-item-active" : ""}`}>
        <item.icon className="size-[17px]" strokeWidth={1.8} />
        <span>{item.label}</span>
        {badge > 0 && <span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">{badge}</span>}
      </Link>
    );
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-[82px] items-center gap-3 px-7">
        <div className="brand-mark"><Home className="size-5" strokeWidth={2.2} /></div>
        <div>
          <div className="font-display text-[21px] font-semibold tracking-tight">nyumba<span className="text-[#8fc09b]">.</span></div>
          <div className="text-xs font-medium tracking-wide text-white/60">Property management</div>
        </div>
      </div>

      <div className="px-4 pt-5">
        <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-white/55">Workspace</p>
        <nav className="flex flex-col gap-1" aria-label="Main navigation">{workspaceNav.map(link)}</nav>
      </div>
      <div className="px-4 pt-8">
        <p className="px-3 pb-2 text-xs font-semibold tracking-wide text-white/55">Manage</p>
        <nav className="flex flex-col gap-1" aria-label="Manage">{manageNav.map(link)}</nav>
      </div>

      <div className="mt-auto p-4">
        {paybill && (
          <div className="rounded-xl border border-white/10 bg-white/[.055] p-3.5">
            <div className="flex items-center gap-2 text-xs font-medium text-white/75"><span className="size-2 rounded-full bg-[#88b391]" /> M-Pesa Paybill active</div>
            <p className="mt-2 text-xs leading-relaxed text-white/60">All tenant payments are reconciled to one paybill.</p>
            <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-3 text-xs text-white/60">
              <span>Paybill number</span><span className="font-mono font-medium tracking-wide text-white/80">{paybill}</span>
            </div>
          </div>
        )}
        <div className="mt-4 flex items-center gap-3 rounded-lg px-2 py-2">
          <div className="avatar-initials size-9 bg-white/15 text-white">{initials(admin.firstName, admin.lastName)}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-xs font-medium text-white/90">{admin.firstName} {admin.lastName}</div>
            <div className="mt-0.5 text-xs text-white/60">Admin</div>
          </div>
          <UserMenu name={`${admin.firstName} ${admin.lastName}`} phone={phoneLabel} className="rounded-md p-1 hover:bg-white/10">
            <Ellipsis className="size-[18px] text-white/65" />
          </UserMenu>
        </div>
      </div>
    </div>
  );
}
