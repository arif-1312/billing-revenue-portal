import CreditNoteForm from "@/components/credit-note/credit-note-form";
import { CreatePageShell } from "@/components/ui/create-page-shell";
import { canAccess } from "@/lib/rbac";
import { redirect } from "next/navigation";

const CreditNoteCreatePage = async () => {
  const canCreate = await canAccess("/admin/credit-note", "create");
  if (!canCreate) {
    redirect("/404");
  }

  return (
    <CreatePageShell title="Add Credit Note" backHref="/admin/credit-note">
      <CreditNoteForm update={false} />
    </CreatePageShell>
  );
};

export default CreditNoteCreatePage;
