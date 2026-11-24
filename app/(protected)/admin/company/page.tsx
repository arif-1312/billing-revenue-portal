import { getCompanys } from "@/lib/actions/company"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import CompanyDataTable from "./company-datatable"
import { canAccess } from "@/lib/rbac"
import { redirect } from "next/navigation"

export default async function CustomerPage() {
  const company = await getCompanys()

  const route = "/admin/company";

  const canView = await canAccess(route, "view")
  if (!canView) {
    redirect("/404");
  }

  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <CompanyDataTable data={company}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Company"
      actions={
        canCreate && (
          <Button className="bg-[#1976D2] hover:bg-[#155EA8]">
            <Link href="/admin/company/create">Add Company</Link>
          </Button>
        )
      } />
  );
}
