import { prisma } from "@/lib/prisma"
import CustomerDatatable from "./customer-datatable"
import { getCustomers } from "@/lib/actions/customer";
import { canAccess, getUserPermissions } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import Link from "next/link";

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
      canEdit={canEdit}
      canDelete={canDelete}
      title="Customer"
      actions={
        canCreate && (
          <Button className="bg-[#1976D2] hover:bg-[#155EA8]">
            <Link href="/admin/customer/create">Add Customer</Link>
          </Button>
        )
      } />
  );
}