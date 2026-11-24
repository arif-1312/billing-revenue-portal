import { getModules } from "@/lib/actions/module-action";
import { redirect } from "next/navigation";
import ModuleDataTable from "./module-data-table";
import { canAccess } from "@/lib/rbac";

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
      canCreate={canCreate}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Module" />
  );
};

export default ModulePage;
