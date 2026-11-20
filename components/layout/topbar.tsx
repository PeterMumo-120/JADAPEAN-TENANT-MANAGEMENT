"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { initials } from "@/lib/format";
import { sectionLabel } from "@/components/layout/nav-config";
import { SidebarContent, type ShellAdmin, type ShellCounts } from "@/components/layout/sidebar-content";
import { UserMenu } from "@/components/layout/user-menu";

export function Topbar({ admin, counts, phoneLabel, monthLabel }: {
  admin: ShellAdmin; counts: ShellCounts; phoneLabel: string; monthLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const name = `${admin.firstName} ${admin.lastName}`;

  return (
    <header className="topbar">
      <div className="flex min-w-0 items-center gap-3">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger render={<Button variant="outline" size="icon" className="lg:hidden" aria-label="Open navigation"><Menu /></Button>} />
          <SheetContent side="left" className="h-dvh w-[280px] border-0 bg-[#183c32] p-0 text-white">
            <SheetHeader className="sr-only"><SheetTitle>Navigation</SheetTitle></SheetHeader>
            <SidebarContent admin={admin} counts={counts} phoneLabel={phoneLabel} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        {/* <div className="hidden text-xs text-muted-foreground sm:block">Workspace <span className="mx-2 text-border">/</span></div> */}
        <span className="truncate text-[13px] font-medium">{sectionLabel(pathname)}</span>
        <span className="hidden rounded-md bg-accent px-2 py-1 text-xs font-medium text-primary sm:inline-flex">{monthLabel}</span>
      </div>

      <div className="flex items-center gap-2">
        {/* <Button variant="ghost" size="icon" aria-label="Help" onClick={() => toast("Need a hand?", { description: "Ask an existing admin, or check the setup notes." })}><CircleHelp /></Button> */}
        {/* <Button variant="ghost" size="icon" className="relative" aria-label="Notifications"
          onClick={() => counts.pendingAdmins > 0 ? router.push("/admins") : toast("You’re all caught up", { description: "No new notifications." })}>
          <Bell />
          {counts.pendingAdmins > 0 && <span className="absolute right-[9px] top-[8px] size-1.5 rounded-full bg-primary" />}
        </Button> */}
        <div className="ml-1 hidden h-8 w-px bg-border sm:block" />
        <UserMenu name={name} phone={phoneLabel} className="flex items-center gap-2 rounded-md p-1 hover:bg-muted">
          <span className="avatar-initials size-8 bg-accent text-primary">{initials(admin.firstName, admin.lastName)}</span>
          <span className="hidden text-xs font-medium sm:block">{admin.firstName}</span>
        </UserMenu>
      </div>
    </header>
  );
}
