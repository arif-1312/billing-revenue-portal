import CustomerDatatable from "./customer-datatable"
import { getCustomers } from "@/lib/actions/customer";
import { canAccess } from "@/lib/rbac";
import { redirect } from "next/navigation";

export default async function CustomerPage() {

  const customers = await getCustomers();
    
  const route = "/admin/customer";
  const canView = await canAccess(route, "view")
  if (!canView) {
    redirect("/404");
  }

  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <CustomerDatatable data={customers}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Customer" />
  );
}
