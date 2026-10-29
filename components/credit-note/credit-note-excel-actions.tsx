"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  exportCreditNoteWorkbook,
  importCreditNoteWorkbook,
  type CreditNoteImportResult,
} from "@/lib/actions/credit-note";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

function downloadWorkbook(base64: string, fileName: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  const blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

export function CreditNoteExcelActions({ canCreate }: { canCreate: boolean }) {
  const router = useRouter();
  const [isExporting, startExport] = useTransition();
  const [isImporting, startImport] = useTransition();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CreditNoteImportResult | null>(null);

  const closeDialog = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFile(null);
      setPreview(null);
    }
  };

  const runExport = () => {
    startExport(async () => {
      const result = await exportCreditNoteWorkbook();
      if (!result.success || !result.base64 || !result.fileName) {
        toast.error("Error", { description: result.message || "Could not download the Excel file." });
        return;
      }

      downloadWorkbook(result.base64, result.fileName);
      toast.success("Success", {
        description: result.rowCount
          ? `Downloaded ${result.rowCount} credit note${result.rowCount === 1 ? "" : "s"}.`
          : "Downloaded the empty Excel template.",
      });
    });
  };

  const runImport = () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);

    startImport(async () => {
      const result = await importCreditNoteWorkbook(formData);
      if (!result.success) {
        setPreview(result);
        toast.error("Error", { description: result.message || "Import was not saved." });
        return;
      }

      toast.success("Success", { description: result.message });
      closeDialog(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={isExporting} onClick={runExport}>
        <Download className="size-4" />
        Excel
      </Button>
      {canCreate ? (
        <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Upload className="size-4" />
          Import
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import credit notes</DialogTitle>
            <DialogDescription>
              Use columns Particulars, Date, Vch Type, Vch No., and Amount. A matching voucher number and date updates the existing row.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
            }}
          />
          {preview?.errors?.length ? (
            <div className="max-h-48 overflow-auto rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
              {preview.errors.slice(0, 12).map((error) => (
                <p key={`${error.row}-${error.message}`}>Row {error.row}: {error.message}</p>
              ))}
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => closeDialog(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={!file || isImporting} onClick={runImport}>
              {isImporting ? "Importing..." : "Import"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
