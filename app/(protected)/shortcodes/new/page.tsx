import { requireAdmin } from "@/lib/auth/require-admin";
import { PageHeader } from "@/components/layout/page-header";
import { ShortcodeForm } from "@/components/shortcodes/shortcode-form";

export default async function NewShortcodePage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Add a payment number" description="Add the M-Pesa number you collect rent on. You can attach buildings to it afterwards." />
      <div className="mt-6 max-w-2xl"><ShortcodeForm /></div>
    </>
  );
}
