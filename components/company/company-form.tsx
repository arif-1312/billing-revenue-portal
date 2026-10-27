"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { SubmitHandler, useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";

import {
  ThemedFormSection,
  themedFieldClassName,
  themedInputClassName,
  themedLabelClassName,
  themedSelectTriggerClassName,
  themedSubmitButtonClassName,
} from "../ui/form-theme";

import { FormHydrationFallback } from "../ui/form-hydration-fallback";

import { useHydrated } from "@/hooks/use-hydrated";

import { Company } from "@/types";
import { companySchema } from "@/lib/validators";
import { companyDefaultValues } from "@/lib/constants";

import {
  createCompany,
  updateCompany,
} from "@/lib/actions/company";

/**
 * IMPORTANT:
 * DO NOT import Prisma enums inside client components.
 * This replaces:
 * import { Status } from "@prisma/client"
 */
const STATUS = {
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE",
} as const;

type CompanyFormValues = z.infer<typeof companySchema>;

export default function CompanyForm({
  data,
  update = false,
}: {
  data?: Company;
  update: boolean;
}) {
  const router = useRouter();

  const id = data?.id;

  const isHydrated = useHydrated();

  const [isPending, startTransition] = React.useTransition();

  const form = useForm<CompanyFormValues>({
    resolver: zodResolver(companySchema),
    defaultValues: data || companyDefaultValues,
  });

  if (!isHydrated) {
    return (
      <FormHydrationFallback
        fields={8}
        sections={1}
        hasTextarea={false}
        submitWidthClassName="w-44"
      />
    );
  }

  const onSubmit: SubmitHandler<CompanyFormValues> = (values) => {
    startTransition(async () => {
      try {
        let res;

        const payload = {
          ...values,
        };

        if (update && id) {
          res = await updateCompany(payload, id);
        } else {
          res = await createCompany(payload);
        }

        if (!res?.success) {
          toast.error("Error", {
            description: res?.message || "Something went wrong",
          });

          return;
        }

        toast.success(
          update
            ? "Company updated successfully"
            : "Company created successfully"
        );

        router.push("/admin/company");
      } catch (error) {
        console.error(error);

        toast.error("Error", {
          description: "Something went wrong",
        });
      }
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <ThemedFormSection title="Company Details">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Company Name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Company Name
                  </FormLabel>

                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter Company name"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Phone */}
            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Phone
                  </FormLabel>

                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter phone number"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Alternate Phone */}
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
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Email */}
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Email
                  </FormLabel>

                  <FormControl>
                    <Input
                      type="email"
                      className={themedInputClassName}
                      placeholder="Enter email"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address Line 1 */}
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
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Address Line 2 */}
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
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* City */}
            <FormField
              control={form.control}
              name="city"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    City
                  </FormLabel>

                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter city"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* State */}
            <FormField
              control={form.control}
              name="state"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    State
                  </FormLabel>

                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter state"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Country */}
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
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Pin Code */}
            <FormField
              control={form.control}
              name="pincode"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Pin Code
                  </FormLabel>

                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter pin code"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* GST */}
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
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* PAN */}
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
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* CIN */}
            <FormField
              control={form.control}
              name="cinNumber"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    CIN Number
                  </FormLabel>

                  <FormControl>
                    <Input
                      className={themedInputClassName}
                      placeholder="Enter CIN number"
                      {...field}
                    />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status */}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>
                    Status
                  </FormLabel>

                  <FormControl>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <SelectTrigger
                        className={themedSelectTriggerClassName}
                      >
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>

                      <SelectContent>
                        <SelectGroup>
                          <SelectItem value={STATUS.ACTIVE}>
                            Active
                          </SelectItem>

                          <SelectItem value={STATUS.INACTIVE}>
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

        {/* Submit */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isPending}
            className={themedSubmitButtonClassName}
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}

            Save Company
          </Button>
        </div>
      </form>
    </Form>
  );
}