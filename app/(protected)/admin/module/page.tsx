import { Button } from "@/components/ui/button";
import Link from "next/link";
import { getModules } from "@/lib/actions/module-action";
import { redirect } from "next/navigation";
import ModuleDataTable from "./module-data-table";
import { canAccess, getUserPermissions } from "@/lib/rbac";

const ModulePage = async () => {

  const modules = await getModules();

  const route = "/admin/module";
  const canView = await canAccess(route, "view")
  if (!canView) {
    redirect("/404");
  }

  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <ModuleDataTable data={modules}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Module"
      actions={
        canCreate && (
          <Button className="bg-[#1976D2] hover:bg-[#155EA8]">
            <Link href="/admin/module/create">Add Module</Link>
          </Button>
        )
      } />
  );
};

export default ModulePage;
