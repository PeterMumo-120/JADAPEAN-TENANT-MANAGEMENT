import { redirect } from "next/navigation";

// Detail views will come later; for now a tenant's page is their edit form.
export default async function TenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/tenants/${id}/edit`);
}
