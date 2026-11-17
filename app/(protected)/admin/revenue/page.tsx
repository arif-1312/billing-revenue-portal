import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getPurchaseOrders } from "@/lib/actions/purschase-order";
import { canAccess } from "@/lib/rbac";
import { redirect } from "next/navigation";
import RevenueDataTable from "./revenue-data-table";

const PurchaseOrdersPage = async () => {
  const res = await getPurchaseOrders();

  const purchaseOrders = res?.success && res?.data ? res.data : [];


  const route = "/admin/revenue";
  const canView = await canAccess(route, "view")
  if (!canView) {
    redirect("/404");
  }
  
  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <RevenueDataTable
      data={JSON.parse(JSON.stringify(purchaseOrders))}
      canEdit={canEdit}
      canDelete={canDelete}
      canCreate={canCreate}
      title="Revenue"
      actions={
        canCreate && (
          <Button className="rounded-lg bg-[#1976D2] text-white shadow-sm hover:bg-[#155EA8]">
            <Link href="/admin/revenue/create">Add Revenue</Link>
          </Button>
        )
      }
    />
  );
};

export default PurchaseOrdersPage;
