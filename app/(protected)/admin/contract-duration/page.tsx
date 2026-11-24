import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getContractDurations } from "@/lib/actions/contract-duration"
import { canAccess } from "@/lib/rbac"
import { redirect } from "next/navigation"
import ContractDurationDataTable from "./contract-duration-datatable"

const ContractDurationPage = async () => {
  const contractDuration = await getContractDurations()
  const route = "/admin/contract-duration";

  const canView = await canAccess(route, "view")
  if (!canView) {
    redirect("/404");
  }

  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <ContractDurationDataTable data={contractDuration}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Contract Duration"
      actions={
        canCreate && (
          <Button className="bg-[#1976D2] hover:bg-[#155EA8]">
            <Link href="/admin/contract-duration/create">Add Contract Duration</Link>
          </Button>
        )
      } />
  );
}

export default ContractDurationPage
