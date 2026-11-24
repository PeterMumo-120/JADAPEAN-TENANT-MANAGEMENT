"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, Users, Wallet } from "lucide-react";
import { useSidebar } from "@/components/layout/shell-frame";
import type { ShellCounts } from "@/components/layout/sidebar-content";

const TABS = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Tenants", href: "/tenants", icon: Users },
  { label: "Payments", href: "/payments", icon: Wallet },
] as const;

/** Phones and small tablets: four big labelled buttons at the bottom of the screen. "More" opens the full menu. */
export function BottomNav({ counts }: { counts: ShellCounts }) {
  const pathname = usePathname();
  const { setMenuOpen } = useSidebar();
  const inTab = TABS.some((t) => pathname === t.href || pathname.startsWith(t.href + "/"));
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/");
        const badge = t.href === "/payments" ? counts.unmatchedPayments : 0;
        return (
          <Link key={t.href} href={t.href} className="bottom-nav-item" data-active={active} aria-current={active ? "page" : undefined}>
            <span className="relative"><t.icon className="size-6" strokeWidth={active ? 2.2 : 1.8} />{badge > 0 && <span className="bottom-nav-badge">{badge > 9 ? "9+" : badge}</span>}</span>
            <span>{t.label}</span>
          </Link>
        );
      })}
      <button type="button" className="bottom-nav-item" data-active={!inTab} onClick={() => setMenuOpen(true)}>
        <span className="relative"><Menu className="size-6" strokeWidth={!inTab ? 2.2 : 1.8} />{counts.pendingAdmins > 0 && <span className="bottom-nav-badge">{counts.pendingAdmins}</span>}</span>
        <span>More</span>
      </button>
    </nav>
  );
}
