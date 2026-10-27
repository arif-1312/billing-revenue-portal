"use client"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Customer } from "@/types"
import { useRouter } from "next/navigation"
import { SubmitHandler, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { customerSchema } from "@/lib/validators"
import { customerDefaultValues } from "@/lib/constants"
import React from "react"
import { createCustomer, updateCustomer } from "@/lib/actions/customer"
import { toast } from "sonner"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "../ui/form"
import { Status } from "@prisma/client"
import { ArrowRight, Loader2 } from "lucide-react"
import z from "zod"
import {
  ThemedFormSection,
  themedFieldClassName,
  themedInputClassName,
  themedLabelClassName,
  themedSelectTriggerClassName,
  themedSubmitButtonClassName,
  themedTextareaClassName,
} from "../ui/form-theme"
import { FormHydrationFallback } from "../ui/form-hydration-fallback"
import { useHydrated } from "@/hooks/use-hydrated"

export default function CustomerForm({ data, update = false }: { data?: Customer, update: boolean }) {

  const router = useRouter();
  const id = data?.id;
  const isHydrated = useHydrated();

  const form = useForm<z.infer<typeof customerSchema>>({
    resolver: zodResolver(customerSchema),
    defaultValues: data || customerDefaultValues,
  });

  const [isPending, startTransition] = React.useTransition();

  if (!isHydrated) {
    return <FormHydrationFallback fields={8} sections={2} submitWidthClassName="w-44" />;
  }

  const onSubmit: SubmitHandler<z.infer<typeof customerSchema>> = (values) => {
    startTransition(async () => {
      let res;

      const payload = {
        ...values,
      };

      if (update && id) {
        res = await updateCustomer(payload, id);
      } else {
        res = await createCustomer(payload);
      }

      if (!res?.success) {
        toast.error("Error", {
          description: res?.message,
        });
      } else {
        router.push("/admin/customer");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ThemedFormSection
          title="Customer Details"
                 >
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <FormField
            control={form.control}
            name="customerCode"
            render={({ field }) => (
              <FormItem className={themedFieldClassName}>
                <FormLabel className={themedLabelClassName}>Customer Code</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter Customer Code" {...field} />
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
                <FormLabel className={themedLabelClassName}>First Name</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter first name" {...field} />
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
                <FormLabel className={themedLabelClassName}>Last Name</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter last name" {...field} />
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
                <FormLabel className={themedLabelClassName}>Company Name</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter company name" {...field} />
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
                  <Input className={themedInputClassName} placeholder="Enter phone number" {...field} />
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
                <FormLabel className={themedLabelClassName}>Alternate Phone</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter alternate phone number" {...field} />
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
                  <Input className={themedInputClassName} type="email" placeholder="Enter email" {...field} />
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
                <FormLabel className={themedLabelClassName}>Website</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter website" {...field} />
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
                <FormLabel className={themedLabelClassName}>Address Line 1</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter address line 1" {...field} />
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
                <FormLabel className={themedLabelClassName}>Address Line 2</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter address line 2" {...field} />
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
                  <Input className={themedInputClassName} placeholder="Enter city" {...field} />
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
                  <Input className={themedInputClassName} placeholder="Enter state" {...field} />
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
                <FormLabel className={themedLabelClassName}>Country</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter country" {...field} />
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
                <FormLabel className={themedLabelClassName}>Postal Code</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter postal code" {...field} />
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
                <FormLabel className={themedLabelClassName}>GST Number</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter GST number" {...field} />
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
                <FormLabel className={themedLabelClassName}>PAN Number</FormLabel>
                <FormControl>
                  <Input className={themedInputClassName} placeholder="Enter PAN number" {...field} />
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
                    defaultValue={field.value}
                    onValueChange={(v) => field.onChange(v as Status)}
                  >
                    <SelectTrigger className={themedSelectTriggerClassName}>
                      <SelectValue placeholder="status" />
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

        <ThemedFormSection title="Notes" description="Keep internal remarks and onboarding context in one place.">
          <FormField
            control={form.control}
            name="remark"
            render={({ field }) => (
              <FormItem className={themedFieldClassName}>
                <FormLabel className={themedLabelClassName}>Remark</FormLabel>
                <FormControl>
                  <Textarea
                    className={themedTextareaClassName}
                    placeholder="Enter Remarks"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ThemedFormSection>

        {/* Submit */}
        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} className={themedSubmitButtonClassName}>
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            Save Customer
          </Button>
        </div>
      </form>
    </Form>

  )
}
