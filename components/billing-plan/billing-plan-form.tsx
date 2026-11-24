"use client";

import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { Status } from "@prisma/client";
import { z } from "zod";

import { billingPlanSchema } from "@/lib/validators";
import { billingPlanDefaultValues } from "@/lib/constants";
import { BillingPlan } from "@/types";
import { createBillingPlan, updateBillingPlan } from "@/lib/actions/billing-plan";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  ThemedFormSection,
  themedFieldClassName,
  themedInputClassName,
  themedLabelClassName,
  themedSelectTriggerClassName,
  themedSubmitButtonClassName,
  themedTextareaClassName,
} from "../ui/form-theme";
import { FormHydrationFallback } from "../ui/form-hydration-fallback";
import { useHydrated } from "@/hooks/use-hydrated";

type BillingCycleFormValues = z.infer<typeof billingPlanSchema>;

const BillingPlanForm = ({
  data,
  update = false,
  onSuccess,
}: {
  data?: BillingPlan;
  update: boolean;
  onSuccess?: () => void;
}) => {
  const router = useRouter();
  const id = data?.id;
  const isHydrated = useHydrated();

  const form = useForm<BillingCycleFormValues>({
    resolver: zodResolver(billingPlanSchema),
    defaultValues: data
      ? {
          ...data,
          billingCycleType: data.billingCycleType as "START" | "MID" | "END",
        }
      : billingPlanDefaultValues,
  });

  const [isPending, startTransition] = React.useTransition();

  if (!isHydrated) {
    return <FormHydrationFallback fields={4} sections={2} submitWidthClassName="w-48" />;
  }

  const onSubmit: SubmitHandler<z.infer<typeof billingPlanSchema>> = (values) => {
    startTransition(async () => {
      const payload = { ...values };
      const res = update && id
        ? await updateBillingPlan(payload, id)
        : await createBillingPlan(payload);

      if (!res?.success) {
        toast.error("Error", {
          description: res?.message,
        });
      } else {
        toast.success(update ? "Billing Plan updated successfully" : "Billing Plan created successfully");
        if (onSuccess) onSuccess();
        else router.push("/admin/billing-plan");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ThemedFormSection
          title="Billing Plan Setup" >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Billing Plan Name</FormLabel>
                  <FormControl>
                    <Input className={themedInputClassName} placeholder="Enter billing plan name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="billingCycleType"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Billing Cycle Type</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className={themedSelectTriggerClassName}>
                        <SelectValue placeholder="Select Cycle Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="START">Start</SelectItem>
                        <SelectItem value="MID">Mid</SelectItem>
                        <SelectItem value="END">End</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="totalBillingCycles"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Total Billing Cycles</FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      type="number"
                      placeholder="Enter total billing cycles"
                      {...field}
                      onChange={(e) => field.onChange(Number(e.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Status</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={(value) => field.onChange(value as Status)}>
                      <SelectTrigger className={themedSelectTriggerClassName}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={Status.ACTIVE}>Active</SelectItem>
                          <SelectItem value={Status.INACTIVE}>Inactive</SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ThemedFormSection>

        <ThemedFormSection title="Notes">
          <FormField
            control={form.control}
            name="remark"
            render={({ field }) => (
              <FormItem className={themedFieldClassName}>
                <FormLabel className={themedLabelClassName}>Remark</FormLabel>
                <FormControl>
                  <Textarea
                    className={themedTextareaClassName}
                    placeholder="Enter remarks"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ThemedFormSection>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} className={themedSubmitButtonClassName}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Save Billing Plan
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default BillingPlanForm;
