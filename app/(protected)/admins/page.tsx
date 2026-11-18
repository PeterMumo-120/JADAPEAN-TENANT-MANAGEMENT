import { desc } from "drizzle-orm";
import { admins } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { dateEA, initials } from "@/lib/format";
import { formatPhone } from "@/lib/phone";
import { PageHeader } from "@/components/layout/page-header";
import { AdminsPanel, type AdminRow } from "@/components/admins/admins-panel";

export default async function AdminsPage() {
  const me = await requireAdmin();
  const all = await getDb().select().from(admins).orderBy(desc(admins.createdAt));

  const rows: AdminRow[] = all.map((a) => ({
    id: a.id,
    name: `${a.firstName} ${a.lastName}`,
    initials: initials(a.firstName, a.lastName),
    phone: formatPhone(a.phone),
    status: a.status,
    requested: dateEA(a.createdAt),
    lastLogin: a.lastLoginAt ? dateEA(a.lastLoginAt) : "Never",
  }));

  return (
    <>
      <PageHeader title="Admins" description="Approve people who requested access, and manage who can sign in." />
      <div className="mt-6">
        <AdminsPanel currentId={me.adminId} pending={rows.filter((r) => r.status === "pending")} members={rows.filter((r) => r.status !== "pending")} />
      </div>
    </>
  );
}
