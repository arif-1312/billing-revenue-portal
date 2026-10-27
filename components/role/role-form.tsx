"use client";

import React from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, ArrowRight } from "lucide-react";
import { Status } from "@prisma/client";
import { z } from "zod";

import { roleSchema } from "@/lib/validators";
import { roleDefaultValues } from "@/lib/constants";
import { createRole, updateRole } from "@/lib/actions/role";
import { Module } from "@/types";
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
} from "@/components/ui/select";
import {
  ThemedFormSection,
  themedCheckboxClassName,
  themedFieldClassName,
  themedInputClassName,
  themedLabelClassName,
  themedSelectTriggerClassName,
  themedSubmitButtonClassName,
  themedTextareaClassName,
} from "@/components/ui/form-theme";
import { FormHydrationFallback } from "@/components/ui/form-hydration-fallback";
import { useHydrated } from "@/hooks/use-hydrated";

type RoleModulePermission = {
  moduleId: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

type PermissionKey = "canView" | "canCreate" | "canEdit" | "canDelete";

const PERMISSION_KEYS: PermissionKey[] = ["canView", "canCreate", "canEdit", "canDelete"];

function fullPermission(moduleId: string): RoleModulePermission {
  return {
    moduleId,
    canView: true,
    canCreate: true,
    canEdit: true,
    canDelete: true,
  };
}

function hasEveryPermission(permission?: RoleModulePermission) {
  return Boolean(
    permission?.canView &&
      permission.canCreate &&
      permission.canEdit &&
      permission.canDelete,
  );
}

type RoleFormData = {
  id?: string;
  roleModules?: RoleModulePermission[];
};

const RoleForm = ({
  data,
  update = false,
  modules,
}: {
  data?: RoleFormData;
  update: boolean;
  modules: Module[];
}) => {
  const router = useRouter();
  const id = data?.id;
  const isHydrated = useHydrated();

  const form = useForm<z.infer<typeof roleSchema>>({
    resolver: zodResolver(roleSchema),
    defaultValues: data || roleDefaultValues,
  });

  const [isPending, startTransition] = React.useTransition();
  const [selectedModules, setSelectedModules] = React.useState<RoleModulePermission[]>(
    update ? (data?.roleModules ?? []) : [],
  );

  if (!isHydrated) {
    return <FormHydrationFallback fields={3} sections={3} submitWidthClassName="w-36" />;
  }

  const onSubmit: SubmitHandler<z.infer<typeof roleSchema>> = (values) => {
    startTransition(async () => {
      const payload = {
        ...values,
        modules: selectedModules,
      };

      const res = update && id
        ? await updateRole(payload, id)
        : await createRole(payload);

      if (!res?.success) {
        toast.error("Error", {
          description: res?.message,
        });
      } else {
        router.push("/admin/roles");
      }
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <ThemedFormSection
          title="Role Details"
          
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Role Name</FormLabel>
                  <FormControl>
                    <Input className={themedInputClassName} placeholder="Enter role name" {...field} />
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

        <ThemedFormSection title="Role Notes">
          <FormField
            control={form.control}
            name="remark"
            render={({ field }) => (
              <FormItem className={themedFieldClassName}>
                <FormLabel className={themedLabelClassName}>Remark</FormLabel>
                <FormControl>
                  <Textarea
                    className={themedTextareaClassName}
                    placeholder="Enter Notes"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ThemedFormSection>

        <ThemedFormSection
          title="Permissions Matrix"
          description="Choose which modules this role can view, create, edit, and delete."
        >
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-sky-100"
              onClick={() =>
                setSelectedModules(
                  modules.flatMap((module) =>
                    module.id ? [fullPermission(module.id)] : [],
                  ),
                )
              }
            >
              Select all
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-sky-100"
              onClick={() => setSelectedModules([])}
            >
              Clear all
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {modules.map((module) => {
              const moduleId = module.id ?? "";
              const selected = selectedModules.find(
                (selectedModule) => selectedModule.moduleId === moduleId,
              );

              return (
                <div
                  key={moduleId || module.name}
                  className="rounded-2xl border border-sky-100 bg-white/85 p-4 shadow-[0_16px_36px_-28px_rgba(14,165,233,0.32)]"
                >
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-left text-base font-semibold text-slate-900">
                      {module.name}
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input
                        type="checkbox"
                        className={themedCheckboxClassName}
                        checked={hasEveryPermission(selected)}
                        onChange={() => {
                          setSelectedModules((prev) => {
                            const rest = prev.filter((item) => item.moduleId !== moduleId);
                            return hasEveryPermission(selected)
                              ? rest
                              : [...rest, fullPermission(moduleId)];
                          });
                        }}
                      />
                      All
                    </label>
                  </div>

                  <div className="flex flex-wrap gap-3 text-sm text-slate-700">
                    {PERMISSION_KEYS.map((key) => {
                      const permission = key.slice(3).toLowerCase();

                      return (
                        <label
                          key={permission}
                          className="flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50/60 px-3 py-1.5"
                        >
                          <input
                            type="checkbox"
                            className={themedCheckboxClassName}
                            checked={selected?.[key] || false}
                            onChange={() => {
                              setSelectedModules((prev) => {
                                const exists = prev.find(
                                  (item) => item.moduleId === moduleId,
                                );

                                if (!exists) {
                                  return [
                                    ...prev,
                                    {
                                      moduleId,
                                      canView: permission === "view",
                                      canCreate: permission === "create",
                                      canEdit: permission === "edit",
                                      canDelete: permission === "delete",
                                    },
                                  ];
                                }

                                return prev.map((item) =>
                                  item.moduleId === moduleId
                                    ? { ...item, [key]: !item[key] }
                                    : item,
                                );
                              });
                            }}
                          />
                          {permission}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </ThemedFormSection>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} className={themedSubmitButtonClassName}>
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="h-4 w-4" />
            )}
            Save Role
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default RoleForm;
