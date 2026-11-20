import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { buildings, payments } from "@/db/schema";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/lib/auth/require-admin";
import { getShortcode } from "@/lib/mpesa/shortcodes";
import { PageHeader } from "@/components/layout/page-header";
import { ShortcodeForm } from "@/components/shortcodes/shortcode-form";

export default async function EditShortcodePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const s = await getShortcode(id);
  if (!s) notFound();
  const db = getDb();
  const [[b], [p]] = await Promise.all([
    db.select({ n: count() }).from(buildings).where(eq(buildings.shortcodeId, id)),
    db.select({ n: count() }).from(payments).where(eq(payments.shortcodeId, id)),
  ]);
  return (
    <>
      <PageHeader title={s.label} description="Update this paybill or till and its Daraja credentials." />
      <div className="mt-6 max-w-2xl">
        <ShortcodeForm shortcode={{ id: s.id, label: s.label, type: s.type, number: s.number, env: s.env, consumerKey: s.consumerKey, hasSecret: !!s.consumerSecretEnc, nominatedNumber: s.nominatedNumber, locked: (b?.n ?? 0) + (p?.n ?? 0) > 0 }} />
      </div>
    </>
  );
}
