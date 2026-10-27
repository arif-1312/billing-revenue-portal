"use client";

import React, { useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";
import { z } from "zod";
import { Status } from "@prisma/client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
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
  themedFieldClassName,
  themedInputClassName,
  themedLabelClassName,
  themedSelectTriggerClassName,
  themedSubmitButtonClassName,
  themedTextareaClassName,
} from "@/components/ui/form-theme";
import { FormHydrationFallback } from "@/components/ui/form-hydration-fallback";
import { createUserSchema, userSchema } from "@/lib/validators";
import { createUser, updateUser } from "@/lib/actions/users";
import { getRoles } from "@/lib/actions/role";
import { User } from "@/types";
import { userDefaultValues } from "@/lib/constants";
import { useHydrated } from "@/hooks/use-hydrated";

type RoleOption = {
  id: string;
  name: string;
};

function normalizeUserFormData(data?: User) {
  if (!data) {
    return userDefaultValues;
  }

  return {
    ...userDefaultValues,
    ...data,
    username: data.username ?? "",
    email: data.email ?? "",
    firstName: data.firstName ?? "",
    lastName: data.lastName ?? "",
    remark: data.remark ?? "",
    roleId: data.roleId ?? "",
    status: data.status ?? userDefaultValues.status,
  };
}

const UserForm = ({ data, update = false }: { data?: User; update: boolean }) => {
  const router = useRouter();
  const id = data?.id;
  const isHydrated = useHydrated();

  const currentSchema = update ? userSchema : createUserSchema;
  const currentData = update
    ? normalizeUserFormData(data)
    : userDefaultValues;

  const form = useForm<z.infer<typeof currentSchema>>({
    resolver: zodResolver(currentSchema),
    defaultValues: currentData,
  });

  const [isPending, startTransition] = React.useTransition();
  const [allRole, setAllRole] = React.useState<RoleOption[]>([]);

  const onSubmit: SubmitHandler<z.infer<typeof currentSchema>> = async (values) => {
    startTransition(async () => {
      const payload = { ...values };
      const res = update && id
        ? await updateUser(payload, id)
        : await createUser(payload);

      if (!res?.success) {
        toast.error("Error", {
          description: res?.message,
        });
      } else {
        router.push("/admin/users");
      }
    });
  };

  useEffect(() => {
    getRoles().then((res) => {
      setAllRole(res);
    });
  }, []);

  if (!isHydrated) {
    return <FormHydrationFallback fields={4} sections={2} submitWidthClassName="w-36" />;
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <ThemedFormSection
          title="User Profile"
         
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Username</FormLabel>
                  <FormControl>
                    <Input className={themedInputClassName} placeholder="Enter username" {...field} />
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
                    <Input className={themedInputClassName} placeholder="Enter email" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {!update && (
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Password</FormLabel>
                    <FormControl>
                      <Input className={themedInputClassName} type="password" placeholder="Enter password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

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
                    <Input className={themedInputClassName} placeholder="Enter last name" {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="roleId"
              render={({ field }) => (
                <FormItem className={themedFieldClassName}>
                  <FormLabel className={themedLabelClassName}>Role</FormLabel>
                  <FormControl>
                    <Select value={field.value ?? ""} onValueChange={field.onChange}>
                      <SelectTrigger className={themedSelectTriggerClassName}>
                        <SelectValue placeholder="Select Role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {allRole.map((role) => (
                            <SelectItem value={role.id} key={role.id}>
                              {role.name}
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

        <ThemedFormSection
          title="Notes"
          description="Add internal remarks or onboarding context for collaborators."
        >
          <FormField
            control={form.control}
            name="remark"
            render={({ field }) => (
              <FormItem className={themedFieldClassName}>
                <FormLabel className={themedLabelClassName}>Remark</FormLabel>
                <FormControl>
                    <Textarea className={themedTextareaClassName} placeholder="Additional notes" {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </ThemedFormSection>

        <div className="flex gap-3">
          <Button type="submit" disabled={isPending} className={themedSubmitButtonClassName}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            {update ? "Update User" : "Save User"}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default UserForm;
