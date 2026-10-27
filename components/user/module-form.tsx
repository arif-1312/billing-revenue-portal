"use client";

import React from "react";
import { SubmitHandler, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader } from "lucide-react";
import z from "zod";
import { Status } from "@prisma/client";

import { moduleSchema } from "@/lib/validators";
import { Module } from "@/types";
import { createModule, updateModule } from "@/lib/actions/module-action";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { Textarea } from "../ui/textarea";
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

type Props = {
  data?: Module;
  update: boolean;
};

const ModuleForm = ({ data, update = false }: Props) => {
  const router = useRouter();
  const id = data?.id;
  const isHydrated = useHydrated();

  const form = useForm<z.infer<typeof moduleSchema>>({
    resolver: zodResolver(moduleSchema),
    defaultValues: data
      ? {
          name: data.name,
          description: data.description,
          route: data.route || "",
          status: data.status,
        }
      : {
          name: "",
          description: "",
          route: "",
          status: Status.ACTIVE,
        },
  });

  const [isPending, startTransition] = React.useTransition();

  if (!isHydrated) {
    return <FormHydrationFallback fields={3} sections={2} submitWidthClassName="w-44" />;
  }

  const onSubmit: SubmitHandler<z.infer<typeof moduleSchema>> = async (values) => {
    startTransition(async () => {
      const res = update && id
        ? await updateModule(values, id)
        : await createModule(values);

      if (!res?.success) {
        toast.error("Error", {
          description: res?.message,
        });
      } else {
        router.push("/admin/module");
      }
    });
  };

  return (
    <Form {...form}>
      <form
        className="space-y-6"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <ThemedFormSection
          title="Module Details"
        
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Name</FormLabel>
                  <FormControl>
                    <Input className={themedInputClassName} placeholder="Enter name" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="route"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Route</FormLabel>
                  <FormControl>
                    <Input className={themedInputClassName} placeholder="Enter route" {...field} />
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
                        <SelectItem value={Status.ACTIVE}>Active</SelectItem>
                        <SelectItem value={Status.INACTIVE}>Inactive</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ThemedFormSection>

        <ThemedFormSection title="Description">
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem className={themedFieldClassName}>
                <FormLabel className={themedLabelClassName}>Description</FormLabel>
                <FormControl>
                  <Textarea
                    rows={8}
                    className={themedTextareaClassName}
                    placeholder="Enter description"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ThemedFormSection>

        <div className="flex gap-2">
          <Button type="submit" className={themedSubmitButtonClassName} disabled={isPending}>
            {isPending ? (
              <Loader className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Save
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default ModuleForm;
