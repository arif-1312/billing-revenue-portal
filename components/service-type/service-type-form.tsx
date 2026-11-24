"use client";

import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { Status } from "@prisma/client";
import { z } from "zod";

import { serviceTypeSchema } from "@/lib/validators";
import { serviceTypeDefaultValues } from "@/lib/constants";
import { ServiceType } from "@/types";
import { createServiceType, updateServiceType } from "@/lib/actions/service-type";
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

const ServiceTypeForm = ({
  data,
  update = false,
  onSuccess,
}: {
  data?: ServiceType;
  update: boolean;
  onSuccess?: () => void;
}) => {
  const router = useRouter();
  const id = data?.id;
  const isHydrated = useHydrated();

  const form = useForm<z.infer<typeof serviceTypeSchema>>({
    resolver: zodResolver(serviceTypeSchema),
    defaultValues: data || serviceTypeDefaultValues,
  });

  const [isPending, startTransition] = React.useTransition();

  if (!isHydrated) {
    return <FormHydrationFallback fields={2} sections={2} submitWidthClassName="w-48" />;
  }

  const onSubmit: SubmitHandler<z.infer<typeof serviceTypeSchema>> = (values) => {
    startTransition(async () => {
      const payload = { ...values };
      const res = update && id
        ? await updateServiceType(payload, id)
        : await createServiceType(payload);

      if (!res?.success) {
        toast.error("Error", {
          description: res?.message,
        });
      } else {
        toast.success(update ? "Service Type updated successfully" : "Service Type created successfully");
        if (onSuccess) onSuccess();
        else router.push("/admin/service-type");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ThemedFormSection title="Service Type" >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Service Type Name</FormLabel>
                  <FormControl>
                    <Input className={themedInputClassName} placeholder="Enter service type name" {...field} />
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
                  <Textarea className={themedTextareaClassName} placeholder="Enter notes" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ThemedFormSection>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} className={themedSubmitButtonClassName}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Save Service Type
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ServiceTypeForm;
