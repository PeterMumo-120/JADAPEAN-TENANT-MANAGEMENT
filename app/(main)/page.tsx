import { redirect } from "next/navigation";
import { Home } from "lucide-react";
import { getSession } from "@/lib/auth/session";
import { AuthTabs } from "@/components/auth/auth-tabs";

export default async function LandingPage() {
  if (await getSession()) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <section className="hidden flex-col justify-between bg-[#183c32] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="brand-mark"><Home className="size-5" strokeWidth={2.2} /></div>
          <div className="font-display text-[22px] font-semibold tracking-tight">rentify<span className="text-[#8fc09b]">.</span></div>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-[44px] font-medium leading-[1.05] tracking-[-.03em]">Rent, tenants and M-Pesa in one place.</h1>
          <p className="mt-4 text-[15px] leading-relaxed text-white/60">See who has paid, who is behind and which houses are empty, without opening a single spreadsheet.</p>
        </div>
      </section>

      <section className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="brand-mark"><Home className="size-5" strokeWidth={2.2} /></div>
            <div className="font-display text-[22px] font-semibold tracking-tight">rentify<span className="text-[#8fc09b]">.</span></div>
          </div>
          <h2 className="font-display text-[30px] font-medium tracking-[-.025em]">Welcome</h2>
          <p className="mb-6 mt-1 text-[13px] text-muted-foreground">Sign in with your phone number, or request access.</p>
          <AuthTabs />
        </div>
      </section>
    </div>
  );
}
