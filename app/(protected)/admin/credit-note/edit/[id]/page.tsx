import { FileMinus } from "lucide-react";
import { notFound, redirect } from "next/navigation";

import CreditNoteForm from "@/components/credit-note/credit-note-form";
import { EditPageShell } from "@/components/ui/edit-page-shell";
import { getCreditNoteById } from "@/lib/actions/credit-note";
import { canAccess } from "@/lib/rbac";

const CreditNoteEditPage = async ({
  params,
}: {
  params: Promise<{ id: string }>;
}) => {
  const { id } = await params;
  if (!id) return notFound();

  const canEdit = await canAccess("/admin/credit-note", "edit");
  if (!canEdit) {
    redirect("/404");
  }

  const creditNote = await getCreditNoteById(id);
  if (!creditNote.success || !creditNote.data) return notFound();

  return (
    <EditPageShell
      title="Edit Credit Note"
      backHref="/admin/credit-note"
      eyebrow="Credit Note"
      icon={FileMinus}
    >
      <CreditNoteForm update={true} data={creditNote.data} />
    </EditPageShell>
  );
};

export default CreditNoteEditPage;
