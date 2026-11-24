import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getContractTypes } from "@/lib/actions/contract-type"
import { canAccess } from "@/lib/rbac"
import { redirect } from "next/navigation"
import ContractTypeDataTable from "./contract-type-datatable"

const RolesPage = async () => {
  const contactTypes = await getContractTypes()

  const route = "/admin/contract-type";
  const canView = await canAccess(route, "view")
  if (!canView) {
    redirect("/404");
  }

  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <ContractTypeDataTable data={contactTypes}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Contract Type"
      actions={
        canCreate && (
          <Button className="bg-[#1976D2] hover:bg-[#155EA8]">
            <Link href="/admin/contract-type/create">Add Contract Type</Link>
          </Button>
        )
      } />
  );
}

export default RolesPage
