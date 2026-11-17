import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getBillingPlans } from "@/lib/actions/billing-plan"
import { canAccess, getUserPermissions } from "@/lib/rbac"
import { redirect } from "next/navigation"
import BillingPlanDataTable from "./billing-plan-datatable"

const RolesPage = async () => {
  const billingPlans = await getBillingPlans()

  const route = "/admin/billing-plan";
  const canView = await canAccess(route, "view")
  if (!canView) {
    redirect("/404");
  }

  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <BillingPlanDataTable data={billingPlans}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Billing Plan"
      actions={
        canCreate && (
          <Button className="bg-[#1976D2] hover:bg-[#155EA8]">
            <Link href="/admin/billing-plan/create">Add Billing Plan</Link>
          </Button>
        )
      } />
  );
}

export default RolesPage