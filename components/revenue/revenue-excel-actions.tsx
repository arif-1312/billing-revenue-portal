"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  commitRevenueImport,
  previewRevenueImport,
  exportRevenueWorkbook,
  type RevenueImportResult,
} from "@/lib/actions/revenue-excel";
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

export function RevenueExcelActions({
  purchaseOrderIds,
  canCreate,
}: {
  purchaseOrderIds: string[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [isExporting, startExport] = useTransition();
  const [isImporting, startImport] = useTransition();
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<RevenueImportResult | null>(null);

  const closeDialog = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setFile(null);
      setPreview(null);
    }
  };

  const runExport = (ids: string[], emptyMessage: string) => {
    startExport(async () => {
      const result = await exportRevenueWorkbook(ids);

      if (!result.success || !result.base64 || !result.fileName) {
        toast.error("Error", {
          description: result.message || "Could not export revenue.",
        });
        return;
      }

      downloadWorkbook(result.base64, result.fileName);
      toast.success("Success", {
        description:
          result.rowCount && result.rowCount > 0
            ? `Exported ${result.rowCount} billing row${result.rowCount === 1 ? "" : "s"}.`
            : emptyMessage,
      });
    });
  };

  const validateFile = () => {
    if (!file) {
      toast.error("Error", { description: "Choose an .xlsx file." });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    startImport(async () => {
      const result = await previewRevenueImport(formData);

      if (!result.success && result.columnErrors.length === 0 && result.errors.length === 0) {
        toast.error("Error", {
          description: result.message || "Could not read the Excel file.",
        });
        setPreview(null);
        return;
      }

      setPreview(result);
    });
  };

  const commitFile = () => {
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    startImport(async () => {
      const result = await commitRevenueImport(formData);

      if (!result.success) {
        setPreview(result);
        toast.error("Error", {
          description: result.message || "Import was not saved.",
        });
        return;
      }

      toast.success("Success", { description: result.message });
      closeDialog(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isExporting}
        title="Export revenue rows matching the current search"
        onClick={() =>
          runExport(
            purchaseOrderIds,
            "No revenue rows match the current search. Downloaded the Excel template.",
          )
        }
      >
        <Download />
        Export Excel
      </Button>

      {canCreate ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          title="Import new billing cycles from Excel"
        >
          <Upload />
          Import Excel
        </Button>
      ) : null}

      <Dialog open={open} onOpenChange={closeDialog}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle>Import revenue Excel</DialogTitle>
            <DialogDescription>
              Invoice numbers that already exist are updated from the file.
              Customer PO Numbers that are not already in the database are
              created as new revenue records. Nothing is deleted. Validation
              is turned off for now.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => runExport([], "Downloaded the Excel template.")}
                disabled={isExporting}
              >
                <Download />
                Download template
              </Button>
              <p className="text-xs text-slate-500">
                The template includes the column headers used by import.
              </p>
            </div>
            <Input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="h-11 text-slate-900 file:mr-3 file:text-slate-900"
              onChange={(event) => {
                setFile(event.target.files?.[0] ?? null);
                setPreview(null);
              }}
            />
            {file ? (
              <p className="text-sm font-medium text-slate-800">
                Selected file: {file.name}
              </p>
            ) : null}

            {preview ? (
              <div className="space-y-4">
                {preview.columnErrors.length > 0 ? (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    <p className="font-medium">Workbook:</p>
                    <ul className="mt-1 list-disc pl-5">
                      {preview.columnErrors.map((message) => (
                        <li key={message}>{message}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {preview.errors.length > 0 ? (
                  <div className="max-h-56 space-y-3 overflow-y-auto rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    {preview.errors.map((error) => (
                      <div key={error.row}>
                        <p className="font-medium">Row {error.row}:</p>
                        <ul className="list-disc pl-5">
                          {error.messages.map((message) => (
                            <li key={message}>{message}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : null}

                {preview.rows.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-slate-600">
                      {preview.rows.length} valid row
                      {preview.rows.length === 1 ? "" : "s"} ready to review.
                      {preview.rows.length > 25
                        ? " Showing the first 25."
                        : ""}
                    </p>
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                          <tr>
                            <th className="px-3 py-2">Row</th>
                            <th className="px-3 py-2">Invoice Number</th>
                            <th className="px-3 py-2">Customer</th>
                            <th className="px-3 py-2">Customer PO Number</th>
                            <th className="px-3 py-2">Invoice Date</th>
                            <th className="px-3 py-2">Invoice Amount</th>
                            <th className="px-3 py-2">Credit Note</th>
                            <th className="px-3 py-2">TDS</th>
                            <th className="px-3 py-2">Payment Received</th>
                          </tr>
                        </thead>
                        <tbody>
                          {preview.rows.slice(0, 25).map((row) => (
                            <tr key={row.excelRow} className="border-t">
                              <td className="px-3 py-2">{row.excelRow}</td>
                              <td className="px-3 py-2">{row.invoiceNumber}</td>
                              <td className="px-3 py-2">{row.customerName || "-"}</td>
                              <td className="px-3 py-2">{row.customerPONumber}</td>
                              <td className="px-3 py-2">{row.invoiceDate}</td>
                              <td className="px-3 py-2">{row.invoiceAmount}</td>
                              <td className="px-3 py-2">{row.creditNote}</td>
                              <td className="px-3 py-2">{row.tds}</td>
                              <td className="px-3 py-2">{row.paymentReceived}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}

                {preview.canCommit ? (
                  <p className="text-sm text-emerald-700">
                    Validation passed. Existing invoice numbers are updated.
                    Missing Customer PO Numbers are created as new revenue
                    records.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={validateFile}
              disabled
              title="Validation is turned off for now"
            >
              Validate
            </Button>
            <Button
              type="button"
              className="bg-teal-600 text-white hover:bg-teal-700"
              onClick={commitFile}
              disabled={isImporting || !file}
            >
              Import records
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
