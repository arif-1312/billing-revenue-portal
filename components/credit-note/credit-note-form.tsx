"use client";

import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { z } from "zod";

import { createCreditNote, updateCreditNote, type CreditNoteRecord } from "@/lib/actions/credit-note";
import { formatKolkataDate } from "@/lib/fiscal-year";
import { creditNoteSchema } from "@/lib/validators";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  ThemedFormSection,
  themedFieldClassName,
  themedInputClassName,
  themedLabelClassName,
  themedSubmitButtonClassName,
} from "../ui/form-theme";
import { FormHydrationFallback } from "../ui/form-hydration-fallback";
import { useHydrated } from "@/hooks/use-hydrated";

const CreditNoteForm = ({
  data,
  update = false,
}: {
  data?: CreditNoteRecord;
  update: boolean;
}) => {
  const router = useRouter();
  const id = data?.id;
  const isHydrated = useHydrated();

  const form = useForm<z.infer<typeof creditNoteSchema>>({
    resolver: zodResolver(creditNoteSchema),
    defaultValues: data ?? {
      particulars: "",
      date: formatKolkataDate(new Date()),
      vchType: "Credit Note",
      vchNo: "",
      amount: 0,
    },
  });

  const [isPending, startTransition] = React.useTransition();

  if (!isHydrated) {
    return <FormHydrationFallback fields={5} sections={1} submitWidthClassName="w-48" />;
  }

  const onSubmit: SubmitHandler<z.infer<typeof creditNoteSchema>> = (values) => {
    startTransition(async () => {
      const res = update && id
        ? await updateCreditNote(values, id)
        : await createCreditNote(values);

      if (!res?.success) {
        toast.error("Error", { description: res?.message });
        return;
      }

      toast.success("Success", { description: res.message });
      router.push("/admin/credit-note");
      router.refresh();
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ThemedFormSection title="Credit Note">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="particulars"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Particulars</FormLabel>
                  <FormControl>
                    <Input className={themedInputClassName} placeholder="Enter particulars" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Date</FormLabel>
                  <FormControl>
                    <Input className={themedInputClassName} type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vchType"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Vch Type</FormLabel>
                  <FormControl>
                    <Input className={themedInputClassName} placeholder="Credit Note" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vchNo"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Vch No.</FormLabel>
                  <FormControl>
                    <Input className={themedInputClassName} placeholder="Enter voucher number" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="amount"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Amount</FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder="Enter amount"
                      name={field.name}
                      ref={field.ref}
                      onBlur={field.onBlur}
                      value={field.value ?? ""}
                      onChange={(event) => {
                        const raw = event.target.value;
                        field.onChange(raw === "" ? 0 : Number(raw));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ThemedFormSection>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} className={themedSubmitButtonClassName}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Save Credit Note
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default CreditNoteForm;
