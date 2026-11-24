"use client";

import { usePathname } from "next/navigation";
import { PanelLeftClose, PanelLeftOpen, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { initials } from "@/lib/format";
import { sectionLabel } from "@/components/layout/nav-config";
import { SidebarContent, type ShellAdmin, type ShellCounts } from "@/components/layout/sidebar-content";
import { useSidebar } from "@/components/layout/shell-frame";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar({ admin, counts, phoneLabel, monthLabel }: {
  admin: ShellAdmin; counts: ShellCounts; phoneLabel: string; monthLabel: string;
}) {
  const pathname = usePathname();
  const { collapsed, toggle, menuOpen, setMenuOpen, largeText, toggleLargeText } = useSidebar();
  const name = `${admin.firstName} ${admin.lastName}`;

  return (
    <header className="topbar">
      <div className="flex min-w-0 items-center gap-3">
        {/* The full menu. On phones it opens from "More" in the bottom bar. */}
        <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
          <SheetContent side="left" className="h-dvh w-[290px] border-0 bg-[#183c32] p-0 text-white">
            <SheetHeader className="sr-only"><SheetTitle>Menu</SheetTitle></SheetHeader>
            <SidebarContent admin={admin} counts={counts} phoneLabel={phoneLabel} onNavigate={() => setMenuOpen(false)} />
          </SheetContent>
        </Sheet>
        <Button variant="ghost" className="hidden gap-2 lg:inline-flex" onClick={toggle} aria-expanded={!collapsed}>
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
          <span className="hidden xl:inline">{collapsed ? "Show menu" : "Hide menu"}</span>
        </Button>
        <span className="truncate text-[15px] font-semibold">{sectionLabel(pathname)}</span>
        <span className="hidden rounded-md bg-accent px-2 py-1 text-xs font-medium text-primary sm:inline-flex">{monthLabel}</span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" onClick={toggleLargeText} aria-pressed={largeText} className="gap-1.5">
          <Type className="size-4" />{largeText ? "Normal text" : "Bigger text"}
        </Button>
        <UserMenu name={name} phone={phoneLabel} className="flex items-center gap-2 rounded-md p-1 hover:bg-muted">
          <span className="avatar-initials size-9 bg-accent text-primary">{initials(admin.firstName, admin.lastName)}</span>
          <span className="hidden text-sm font-medium md:block">{admin.firstName}</span>
        </UserMenu>
      </div>
    </header>
  );
}
