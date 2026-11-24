import { getBillingPlans } from "@/lib/actions/billing-plan"
import { canAccess } from "@/lib/rbac"
import { redirect } from "next/navigation"
import BillingPlanDataTable from "./billing-plan-datatable"

const RolesPage = async () => {
  const billingPlanResult = await getBillingPlans()
  const billingPlans = Array.isArray(billingPlanResult) ? billingPlanResult : []

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
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Billing Plan" />
  );
}

export default RolesPage
