import Link from "next/link"
import { Button } from "@/components/ui/button"
import { getUsers } from "@/lib/actions/users"
import { redirect } from "next/navigation";
import { canAccess, getUserPermissions } from "@/lib/rbac"
import UserDataTable from "./user-datatable"

export default async function UsersPage() {
  const users = await getUsers()

  const route = "/admin/users";

  const canView = await canAccess(route, "view")

  if (!canView) {
    redirect("/404");
  }

  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <UserDataTable data={users}
      canEdit={canEdit}
      canDelete={canDelete}
      title="User"
      actions={
        canCreate && (
          <Button className="bg-[#1976D2] hover:bg-[#155EA8]">
            <Link href="/admin/users/create">Add Create</Link>
          </Button>
        )
      } />
  )
}