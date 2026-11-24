import { redirect } from "next/navigation";

import { getVendors } from "@/lib/actions/vendor";
import { canAccess } from "@/lib/rbac";

import VendorDataTable from "./vendor-datatable";

export default async function VendorPage() {
  const route = "/admin/vendor";
  const canView = await canAccess(route, "view");
  if (!canView) {
    redirect("/404");
  }

  const vendors = await getVendors();

  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <VendorDataTable
      data={vendors}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Vendor"
    />
  );
}
