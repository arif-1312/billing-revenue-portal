"use client"

import * as React from "react"
import { Button } from "./button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "./dialog"

type DeleteDialogProps = {
  onConfirm: () => void | Promise<void>
  children?: React.ReactNode
  title?: string
  description?: string
  confirmText?: string
  cancelText?: string
  preventOutsideDismiss?: boolean
}

export function DeleteDialog({
  onConfirm,
  children,
  title = "Are you sure?",
  description = "Click confirm to delete",
  confirmText = "Confirm",
  cancelText = "Cancel",
  preventOutsideDismiss = false,
}: DeleteDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [isPending, setIsPending] = React.useState(false)

  const handleConfirm = async () => {
    try {
      setIsPending(true)
      await onConfirm()
      setOpen(false)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        onInteractOutside={preventOutsideDismiss ? (event) => event.preventDefault() : undefined}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            {cancelText}
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isPending}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
