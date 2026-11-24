import { getServiceTypes } from "@/lib/actions/service-type"
import { canAccess } from "@/lib/rbac"
import { redirect } from "next/navigation"
import ServiceTypeDataTable from "./service-type-datatable"

const ServiceTypePage = async () => {
  const serviceTypes = await getServiceTypes()

  const route = "/admin/service-type";

  const canView = await canAccess(route, "view");

  if (!canView) {
    redirect("/404");
  }

  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <ServiceTypeDataTable data={serviceTypes}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Service Type" />
  )
}

export default ServiceTypePage
