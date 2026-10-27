"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Handshake, Loader2 } from "lucide-react";
import { Status } from "@prisma/client";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";

import { createVendor, updateVendor } from "@/lib/actions/vendor";
import { vendorDefaultValues } from "@/lib/constants";
import { vendorSchema } from "@/lib/validators";
import { Vendor } from "@/types";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormHydrationFallback } from "@/components/ui/form-hydration-fallback";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ThemedFormSection,
  themedFieldClassName,
  themedInputClassName,
  themedLabelClassName,
  themedSelectTriggerClassName,
  themedSubmitButtonClassName,
  themedTextareaClassName,
} from "@/components/ui/form-theme";
import { useHydrated } from "@/hooks/use-hydrated";

export default function VendorForm({
  data,
  update = false,
}: {
  data?: Vendor;
  update: boolean;
}) {
  const router = useRouter();
  const id = data?.id;
  const isHydrated = useHydrated();

  const form = useForm<z.infer<typeof vendorSchema>>({
    resolver: zodResolver(vendorSchema),
    defaultValues: data || vendorDefaultValues,
  });

  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (!data) {
      form.reset(vendorDefaultValues);
      return;
    }

    form.reset({
      ...vendorDefaultValues,
      ...data,
    });
  }, [data, form]);

  if (!isHydrated) {
    return (
      <FormHydrationFallback
        fields={8}
        sections={2}
        submitWidthClassName="w-44"
      />
    );
  }

  const onSubmit: SubmitHandler<z.infer<typeof vendorSchema>> = (values) => {
    startTransition(async () => {
      const payload = {
        ...values,
      };

      let res;

      if (update) {
        if (!id) {
          toast.error("Error", {
            description:
              "Vendor id is missing. Please reopen the edit page and try again.",
          });
          return;
        }

        res = await updateVendor(payload, id);
      } else {
        res = await createVendor(payload);
      }

      if (!res?.success) {
        toast.error("Error", {
          description: res?.message,
        });
        return;
      }

      toast.success("Success", {
        description: res?.message,
      });
      router.refresh();
      router.push("/admin/vendor");
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <ThemedFormSection title="Vendor Details">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="vendorCode"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Vendor Code
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter Vendor Code"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="companyName"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Vendor Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter company name"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    First Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter first name"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Last Name
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter last name"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Phone</FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter phone number"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="alternatePhone"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Alternate Phone
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter alternate phone number"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Email</FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      type="email"
                      placeholder="Enter email"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="website"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Website
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter website"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressLine1"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Address Line 1
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter address line 1"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="addressLine2"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Address Line 2
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter address line 2"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>City</FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter city"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>State</FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter state"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="country"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Country
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter country"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="postalCode"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Postal Code
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter postal code"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="gstNumber"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    GST Number
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter GST number"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="panNumber"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    PAN Number
                  </FormLabel>
                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter PAN number"
                      {...field}
                      value={field.value ?? ""}
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
                    <Select
                      value={field.value ?? Status.ACTIVE}
                      onValueChange={(value) => field.onChange(value as Status)}
                    >
                      <SelectTrigger className={themedSelectTriggerClassName}>
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={Status.ACTIVE}>Active</SelectItem>
                          <SelectItem value={Status.INACTIVE}>
                            Inactive
                          </SelectItem>
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

        <ThemedFormSection
          title="Notes"
          description="Keep vendor onboarding and commercial notes together."
        >
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
          <Button
            type="submit"
            disabled={isPending}
            className={themedSubmitButtonClassName}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Handshake className="w-4 h-4" />
            )}
            {update ? "Update Vendor" : "Save Vendor"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
