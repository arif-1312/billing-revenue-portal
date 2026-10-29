import Link from "next/link";

import { CreditNoteExcelActions } from "@/components/credit-note/credit-note-excel-actions";
import { Button } from "@/components/ui/button";
import { getCreditNotes } from "@/lib/actions/credit-note";
import { canAccess } from "@/lib/rbac";
import { redirect } from "next/navigation";

import CreditNoteDataTable from "./credit-note-datatable";

const CreditNotePage = async () => {
  const route = "/admin/credit-note";
  const canView = await canAccess(route, "view");

  if (!canView) {
    redirect("/404");
  }

  const notes = await getCreditNotes();
  const canCreate = await canAccess(route, "create");
  const canEdit = await canAccess(route, "edit");
  const canDelete = await canAccess(route, "delete");

  return (
    <CreditNoteDataTable
      data={notes}
      canEdit={canEdit}
      canDelete={canDelete}
      title="Credit Note"
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <CreditNoteExcelActions canCreate={canCreate} />
          {canCreate ? (
            <Button className="rounded-xl bg-sky-600 text-white shadow-sm hover:bg-sky-700">
              <Link href="/admin/credit-note/create">Add Credit Note</Link>
            </Button>
          ) : null}
        </div>
      }
    />
  );
};

export default CreditNotePage;
