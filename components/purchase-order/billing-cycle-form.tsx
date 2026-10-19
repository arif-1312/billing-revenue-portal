"use client";

import { useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2 } from "lucide-react";
import { PaymentReceived } from "@prisma/client";
import { FieldPathValue, UseFormReturn, useFieldArray, useWatch } from "react-hook-form";
import { z } from "zod";

import { cn } from "@/lib/utils";
import { purchaseOrderSchema } from "@/lib/validators";
import {
  formatBillingCycleLabel,
  MONTH_NAMES,
} from "@/lib/billing-cycle-utils";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Textarea } from "../ui/textarea";
import {
  themedFieldClassName,
  themedInputClassName,
  themedLabelClassName,
  themedSelectTriggerClassName,
  themedTextareaClassName,
} from "../ui/form-theme";

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
type BillingCycleField = PurchaseOrderFormValues["billingCycles"][number];
type BillingCycleDateFieldName =
  | `billingCycles.${number}.invoiceDate`
  | `billingCycles.${number}.paymentDueDate`
  | `billingCycles.${number}.billingSubmittedDate`;

const dateButtonClassName = (hasValue?: boolean) =>
  cn(
    themedSelectTriggerClassName,
    "justify-start text-left font-normal",
    !hasValue && "text-muted-foreground",
  );

const getValidDate = (value?: Date | string | null) => {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
};

interface BillingCycleFormProps {
  field: BillingCycleField;
  index: number;
  form: UseFormReturn<PurchaseOrderFormValues>;
  canEditInvoiceAmount?: boolean;
  canRemoveCycle?: boolean;
  onRemoveCycle?: () => void;
}

const BillingCycleForm = ({
  field,
  index,
  form,
  canEditInvoiceAmount = false,
  canRemoveCycle = false,
  onRemoveCycle,
}: BillingCycleFormProps) => {
  const setBillingCycleDateValue = <TFieldName extends BillingCycleDateFieldName>(
    name: TFieldName,
    value: FieldPathValue<PurchaseOrderFormValues, TFieldName>,
  ) => {
    form.setValue(name, value, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
  };

  const invoiceDate =
    form.watch(`billingCycles.${index}.invoiceDate`) ?? field?.invoiceDate;
  const billingSubmittedDate =
    form.watch(`billingCycles.${index}.billingSubmittedDate`) ??
    field?.billingSubmittedDate;
  const invoiceAmount = Number(
    form.watch(`billingCycles.${index}.invoiceAmount`) || 0,
  );
  const { fields: paymentFields, append: appendPayment, remove: removePayment } = useFieldArray({
    control: form.control,
    name: `billingCycles.${index}.payments`,
  });
  const payments = useWatch({
    control: form.control,
    name: `billingCycles.${index}.payments`,
  }) ?? [];
  const paymentSignature = payments
    .map((payment) => `${payment?.receivedDate ?? ""}:${payment?.amount ?? ""}`)
    .join("|");

  useEffect(() => {
    if (!payments.length) return;

    const total = payments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0);
    const currentTotal = Number(form.getValues(`billingCycles.${index}.collectedAmount`) || 0);
    if (currentTotal !== total) {
      form.setValue(`billingCycles.${index}.collectedAmount`, total, { shouldDirty: true });
    }

    const latest = payments
      .map((payment) => (payment?.receivedDate ? new Date(payment.receivedDate) : null))
      .filter((date): date is Date => date instanceof Date && !Number.isNaN(date.getTime()))
      .sort((left, right) => left.getTime() - right.getTime())
      .at(-1) ?? null;
    const currentDate = form.getValues(`billingCycles.${index}.paymentReceivedDate`);
    const currentTime = currentDate ? new Date(currentDate).getTime() : null;
    if (currentTime !== (latest?.getTime() ?? null)) {
      form.setValue(`billingCycles.${index}.paymentReceivedDate`, latest, { shouldDirty: true });
    }

    if (total > 0 && form.getValues(`billingCycles.${index}.paymentReceived`) !== PaymentReceived.YES) {
      form.setValue(`billingCycles.${index}.paymentReceived`, PaymentReceived.YES, { shouldDirty: true });
    }
  }, [form, index, paymentSignature, payments]);

  const collectedAmount = Number(
    form.watch(`billingCycles.${index}.collectedAmount`) || 0,
  );
  const tdsAmount = Number(form.watch(`billingCycles.${index}.tds`) || 0);
  const pendingAmount = invoiceAmount - collectedAmount;
  const poStartDate = form.watch("startFrom");
  const poEndDate = form.watch("endDate");
  const cycleReferenceDate =
    getValidDate(invoiceDate) ??
    getValidDate(billingSubmittedDate) ??
    getValidDate(poStartDate) ??
    getValidDate(poEndDate) ??
    new Date();
  const selectedMonth = cycleReferenceDate.getMonth().toString();
  const selectedYear = cycleReferenceDate.getFullYear().toString();
  const startYear = getValidDate(poStartDate)?.getFullYear();
  const endYear = getValidDate(poEndDate)?.getFullYear();
  const minYear = Math.min(
    startYear ?? cycleReferenceDate.getFullYear(),
    endYear ?? cycleReferenceDate.getFullYear(),
    cycleReferenceDate.getFullYear(),
  );
  const maxYear = Math.max(
    startYear ?? cycleReferenceDate.getFullYear(),
    endYear ?? cycleReferenceDate.getFullYear(),
    cycleReferenceDate.getFullYear() + 2,
  );
  const yearOptions = Array.from(
    { length: Math.max(1, maxYear - minYear + 1) },
    (_, yearIndex) => (minYear + yearIndex).toString(),
  );

  const updateBillingCyclePeriod = (
    nextMonthValue: string,
    nextYearValue: string,
  ) => {
    const nextMonth = Number(nextMonthValue);
    const nextYear = Number(nextYearValue);

    if (Number.isNaN(nextMonth) || Number.isNaN(nextYear)) return;

    const existingInvoiceDate = getValidDate(invoiceDate);
    const invoiceDay = existingInvoiceDate?.getDate() ?? 1;
    const nextInvoiceDate = new Date(nextYear, nextMonth, invoiceDay);

    setBillingCycleDateValue(
      `billingCycles.${index}.invoiceDate`,
      nextInvoiceDate,
    );
    setBillingCycleDateValue(
      `billingCycles.${index}.billingSubmittedDate`,
      nextInvoiceDate,
    );
    setBillingCycleDateValue(
      `billingCycles.${index}.paymentDueDate`,
      nextInvoiceDate,
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 border-b pb-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-bold">
            {formatBillingCycleLabel(invoiceDate ?? billingSubmittedDate)}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-4 text-sm font-medium">
          <span>Invoice: Rs.{invoiceAmount.toLocaleString()}</span>
          <span>Collected amount without GST: Rs.{collectedAmount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          <span>Pending: Rs.{pendingAmount.toLocaleString()}</span>
          <span>TDS: Rs.{tdsAmount.toLocaleString()}</span>
          {canRemoveCycle && onRemoveCycle ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
              onClick={onRemoveCycle}
            >
              Remove Cycle
            </Button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {canEditInvoiceAmount ? (
          <>
            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>
                Billing Month
              </FormLabel>
              <FormControl>
                <Select
                  value={selectedMonth}
                  onValueChange={(value) =>
                    updateBillingCyclePeriod(value, selectedYear)
                  }
                >
                  <SelectTrigger className={themedSelectTriggerClassName}>
                    <SelectValue placeholder="Select Billing Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {MONTH_NAMES.map((monthName, monthIndex) => (
                        <SelectItem
                          value={monthIndex.toString()}
                          key={monthName}
                        >
                          {monthName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>

            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>
                Billing Year
              </FormLabel>
              <FormControl>
                <Select
                  value={selectedYear}
                  onValueChange={(value) =>
                    updateBillingCyclePeriod(selectedMonth, value)
                  }
                >
                  <SelectTrigger className={themedSelectTriggerClassName}>
                    <SelectValue placeholder="Select Billing Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {yearOptions.map((yearValue) => (
                        <SelectItem value={yearValue} key={yearValue}>
                          {yearValue}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          </>
        ) : null}

        <FormField
          control={form.control}
          name={`billingCycles.${index}.invoiceNumber`}
          render={({ field }) => (
            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>
                Invoice Number
              </FormLabel>
              <FormControl>
                <Input
                  className={themedInputClassName}
                  placeholder="Enter Invoice Number"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`billingCycles.${index}.invoiceAmount`}
          render={({ field }) => (
            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>
                Invoice Amount
              </FormLabel>
              <FormControl>
                <Input
                  className={themedInputClassName}
                  type="number"
                  placeholder="Enter Invoice Amount"
                  {...field}
                  onChange={(event) =>
                    field.onChange(Number(event.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`billingCycles.${index}.collectedAmount`}
          render={({ field }) => (
            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>
                Collected Amount
              </FormLabel>
              <FormControl>
                <Input
                  className={themedInputClassName}
                  type="number"
                  placeholder="Enter Collected Amount"
                  readOnly={paymentFields.length > 0}
                  {...field}
                  onChange={(event) =>
                    field.onChange(Number(event.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`billingCycles.${index}.tds`}
          render={({ field }) => (
            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>TDS</FormLabel>
              <FormControl>
                <Input
                  className={themedInputClassName}
                  type="number"
                  placeholder="Enter TDS"
                  {...field}
                  onChange={(event) =>
                    field.onChange(Number(event.target.value))
                  }
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`billingCycles.${index}.invoiceDate`}
          render={({ field }) => (
            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>Invoice Date</FormLabel>
              <FormControl>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={dateButtonClassName(!!field.value)}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    avoidCollisions={false}
                    className="w-auto p-0"
                    side="bottom"
                    sideOffset={8}
                  >
                    <Calendar
                      mode="single"
                      selected={field.value as Date}
                      onSelect={(date) => {
                        field.onChange(date);
                        setBillingCycleDateValue(
                          `billingCycles.${index}.billingSubmittedDate`,
                          date ?? null,
                        );
                        setBillingCycleDateValue(
                          `billingCycles.${index}.paymentDueDate`,
                          date ?? null,
                        );
                      }}
                    />
                  </PopoverContent>
                </Popover>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`billingCycles.${index}.billingSubmittedDate`}
          render={({ field }) => (
            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>
                Billing Submitted Date
              </FormLabel>
              <FormControl>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={dateButtonClassName(!!field.value)}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    avoidCollisions={false}
                    className="w-auto p-0"
                    side="bottom"
                    sideOffset={8}
                  >
                    <Calendar
                      mode="single"
                      selected={field.value as Date}
                      onSelect={field.onChange}
                    />
                  </PopoverContent>
                </Popover>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`billingCycles.${index}.paymentReceived`}
          render={({ field }) => (
            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>
                Payment Received
              </FormLabel>
              <FormControl>
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                >
                  <SelectTrigger className={themedSelectTriggerClassName}>
                    <SelectValue placeholder="Payment Received" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.values(PaymentReceived).map((status) => (
                        <SelectItem value={status} key={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="space-y-3 md:col-span-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={themedLabelClassName}>Payment received dates</p>
              <p className="text-xs text-slate-500">
                Add each receipt. The dashboard counts that amount in the month of its received date.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => appendPayment({ receivedDate: null, amount: 0 })}
            >
              <Plus />
              Add date
            </Button>
          </div>
          {paymentFields.length === 0 ? (
            <p className="text-sm text-slate-500">No receipt dates yet.</p>
          ) : (
            paymentFields.map((paymentField, paymentIndex) => (
              <div key={paymentField.id} className="grid grid-cols-1 items-start gap-5 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name={`billingCycles.${index}.payments.${paymentIndex}.receivedDate`}
                  render={({ field }) => (
                    <FormItem className={themedFieldClassName}>
                      <FormLabel className={themedLabelClassName}>Received date</FormLabel>
                      <FormControl>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={dateButtonClassName(!!field.value)}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? format(new Date(field.value), "PPP") : "Pick a date"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            avoidCollisions={false}
                            className="w-auto p-0"
                            side="bottom"
                            sideOffset={8}
                          >
                            <Calendar
                              mode="single"
                              selected={field.value ? new Date(field.value) : undefined}
                              onSelect={field.onChange}
                            />
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex items-start gap-3">
                  <FormField
                    control={form.control}
                    name={`billingCycles.${index}.payments.${paymentIndex}.amount`}
                    render={({ field }) => (
                      <FormItem className={cn(themedFieldClassName, "min-w-0 flex-1")}>
                        <FormLabel className={themedLabelClassName}>Amount</FormLabel>
                        <FormControl>
                          <Input
                            className={themedInputClassName}
                            type="number"
                            min={0}
                            placeholder="Amount"
                            value={field.value ?? ""}
                            onChange={(event) => field.onChange(event.target.value === "" ? 0 : Number(event.target.value))}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="mt-8 shrink-0 border-rose-200 text-rose-600 hover:bg-rose-50"
                    aria-label="Remove payment received date"
                    onClick={() => {
                      removePayment(paymentIndex);
                      if (paymentFields.length === 1) {
                        form.setValue(`billingCycles.${index}.paymentReceivedDate`, null);
                      }
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>

        <FormField
          control={form.control}
          name={`billingCycles.${index}.paymentDueDate`}
          render={({ field }) => (
            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>
                Payment Due Date
              </FormLabel>
              <FormControl>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={dateButtonClassName(!!field.value)}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {field.value ? format(field.value, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    avoidCollisions={false}
                    className="w-auto p-0"
                    side="bottom"
                    sideOffset={8}
                  >
                    <Calendar
                      mode="single"
                      selected={field.value as Date}
                      onSelect={field.onChange}
                    />
                  </PopoverContent>
                </Popover>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name={`billingCycles.${index}.billingRemark`}
          render={({ field }) => (
            <FormItem className="md:col-span-2">
              <FormLabel className={themedLabelClassName}>Remark</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Additional notes"
                  className={themedTextareaClassName}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  );
};

export default BillingCycleForm;
