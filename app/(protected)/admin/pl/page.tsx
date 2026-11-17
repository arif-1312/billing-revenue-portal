import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Role } from "@prisma/client";
import { getRoles } from "@/lib/actions/role";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServiceTypes } from "@/lib/actions/service-type";
import { Project } from "@/types";
import { getProjects } from "@/lib/actions/project";
import PLDataTable from "./pl-datatable";
import { canAccess, getUserPermissions } from "@/lib/rbac";
import { redirect } from "next/navigation";

const ProjectPage = async () => {
  let projects = await getProjects();
  projects = JSON.parse(JSON.stringify(projects));

  const route = "/admin/pl";
  const canView = await canAccess(route, "view");

  if (!canView) {
    redirect("/404");
  }

  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <PLDataTable
      data={projects}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Project"
      actions={
        canCreate && (
          <Button className="bg-[#1976D2] hover:bg-[#155EA8] text-white shadow-md">
            <Link href="/admin/pl/create">Add Project</Link>
          </Button>
        )
      }
    />
  );
};

export default ProjectPage;
