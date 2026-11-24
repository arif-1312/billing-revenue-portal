"use client";

import moment from "moment";
import { AccordionItem, AccordionContent, AccordionTrigger } from "../ui/accordion";
import { FormField, FormItem, FormLabel, FormControl, FormMessage } from "../ui/form";
import { Input } from "../ui/input";
import { useFieldArray, type UseFormReturn } from "react-hook-form";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Trash2 } from "lucide-react";
import { z } from "zod";
import { projectMonthlyPLSchema, projectSchema } from "@/lib/validators";

interface OtherCost {
  key: string;
  value: number | string;
}

type BillingCycleField = z.infer<typeof projectMonthlyPLSchema>;

interface PLBillingCycleProps {
  field: BillingCycleField;
  index: number;
  form: UseFormReturn<z.infer<typeof projectSchema>>;
}

const PLBillingCycle = ({ field, index, form }: PLBillingCycleProps) => {
  const monthIndex = Number(field?.month ?? 0);
  const year = Number(field?.year ?? new Date().getFullYear());
  const monthName = moment().month(monthIndex).format("MMMM");

  const { fields: otherFields, append, remove } = useFieldArray({
    control: form.control,
    name: `billingCycle.${index}.otherCost`,
  });

  const addMiscellaneousAmount = () => append({ key: "", value: 0 });

  const otherBills: OtherCost[] = form.watch(`billingCycle.${index}.otherCost`) ?? [];
  const billedAmount = Number(form.watch(`billingCycle.${index}.billedAmount`) ?? 0);
  const totalOtherBillAmount = otherBills.reduce(
    (sum, bill) => sum + Number(bill.value || 0),
    0,
  );
  const monthlyGMPercentage = billedAmount > 0
    ? Number(((totalOtherBillAmount / billedAmount) * 100).toFixed(2))
    : 0;

  return (
    <AccordionItem value={`billing-cycle-${index}`}>
      <AccordionTrigger>
        {monthName} {year}
      </AccordionTrigger>
      <AccordionContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2 col-span-2">
            <FormField
              control={form.control}
              name={`billingCycle.${index}.billedAmount`}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billing Amount</FormLabel>
                  <FormControl>
                    <Input type="number" placeholder="Enter Billing Amount" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="space-y-2 col-span-2">
            <div className="flex justify-between items-center">
              <h2>Total Other Bill Amount: ₹{totalOtherBillAmount.toLocaleString()}</h2>
              <h2>Monthly GM%: {monthlyGMPercentage}%</h2>
              <Button type="button" variant="default" onClick={addMiscellaneousAmount}>
                Add Miscellaneous Amount
              </Button>
            </div>

            {otherFields.map((field, ind) => (
              <Card key={ind}>
                <CardContent>
                  <div className="mb-3 flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove miscellaneous amount ${ind + 1}`}
                      onClick={() => remove(ind)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name={`billingCycle.${index}.otherCost.${ind}.key`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Key</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter Key" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`billingCycle.${index}.otherCost.${ind}.value`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="Enter Value" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </AccordionContent>
    </AccordionItem>
  );
};

export default PLBillingCycle;
