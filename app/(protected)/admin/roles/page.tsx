import { getRoles } from "@/lib/actions/role"
import { getModules } from "@/lib/actions/module-action"
import { canAccess } from "@/lib/rbac"
import { redirect } from "next/navigation"
import RoleDataTable from "./role-datatable"

const RolesPage = async () => {
  const route = "/admin/roles";
  const canView = await canAccess(route, "view")

  if (!canView) {
    redirect("/404");
  }

  const roles = await getRoles()
  const modules = await getModules()
  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");


  return (
    <RoleDataTable data={roles}
      modules={modules}
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Role" />
  )
}

export default RolesPage
