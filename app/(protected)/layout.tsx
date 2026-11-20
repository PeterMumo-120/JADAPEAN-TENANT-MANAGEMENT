import { count, eq } from "drizzle-orm";
import { admins, payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SidebarContent } from "@/components/layout/sidebar-content";
import { Topbar } from "@/components/layout/topbar";

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const me = await requireAdmin();
  const db = getDb();
  const [[pending], [unmatched]] = await Promise.all([
    db.select({ n: count() }).from(admins).where(eq(admins.status, "pending")),
    db.select({ n: count() }).from(payments).where(eq(payments.status, "unmatched")),
  ]);

  const admin = { firstName: me.firstName, lastName: me.lastName, phone: me.phone };
  const counts = { pendingAdmins: pending?.n ?? 0, unmatchedPayments: unmatched?.n ?? 0 };
  const phoneLabel = formatPhone(me.phone);
  const monthLabel = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "Africa/Nairobi" }).format(new Date());

  return (
    <div className="app-shell min-h-screen">
      <aside className="sidebar">
        <SidebarContent admin={admin} counts={counts} phoneLabel={phoneLabel} />
      </aside>
      <main className="main-area min-w-0">
        <Topbar admin={admin} counts={counts} phoneLabel={phoneLabel} monthLabel={monthLabel} />
        <div className="page-wrap">
          {children}
          {/* <footer className="page-footer">
            <span>© 2026 Nyumba Property Management</span>
            <span className="hidden sm:inline">Made for better living in Kenya</span>
          </footer> */}
        </div>
      </main>
    </div>
  );
}
