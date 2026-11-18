"use client";

import { startTransition } from "react";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { logoutAction } from "@/lib/auth/actions";

export function UserMenu({ name, phone, className, children }: { name: string; phone: string; className?: string; children: React.ReactNode }) {
  function signOut() {
    toast("Signing out…");
    startTransition(async () => { await logoutAction(); });
  }
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<button type="button" className={className} aria-label="Account menu">{children}</button>} />
      <DropdownMenuContent align="end" className="min-w-52">
        <div className="px-2 py-1.5">
          <div className="text-xs font-medium">{name}</div>
          <div className="text-xs text-muted-foreground">{phone}</div>
        </div>
        <DropdownMenuItem onClick={signOut}><LogOut className="size-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
