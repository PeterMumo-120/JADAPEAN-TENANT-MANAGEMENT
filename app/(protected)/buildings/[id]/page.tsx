import { redirect } from "next/navigation";

// Detail views will come later; for now a building's page is its edit form.
export default async function BuildingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/buildings/${id}/edit`);
}
