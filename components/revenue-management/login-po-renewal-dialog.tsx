"use client";

import { useState } from "react";

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PoRenewalTable } from "./po-renewal-table";

export function LoginPoRenewalDialog() {
  const [open, setOpen] = useState(true);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      const url = new URL(window.location.href);
      url.searchParams.delete("showPoRenewals");
      window.history.replaceState(window.history.state, "", url);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle>PO renewal details</DialogTitle>
          <DialogDescription>
            Review live purchase orders ending within the next 30 days.
          </DialogDescription>
        </DialogHeader>
        <PoRenewalTable />
      </DialogContent>
    </Dialog>
  );
}
