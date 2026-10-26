"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  BellRing,
  Building2,
  Globe,
  ImageIcon,
  Mail,
  Palette,
  Save,
} from "lucide-react";

import { saveConfigurationFromForm } from "@/lib/actions/configuration";
import { configurationSchema } from "@/lib/validators";
import { Configuration } from "@/types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

type ConfigurationFormProps = {
  data?: Configuration & { passwordConfigured?: boolean };
};

function SectionHeader({
  title,
  description,
  icon: Icon,
  action,
}: {
  title: string;
  description: string;
  icon: React.ElementType;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-start gap-4">
        <div className="rounded-2xl border border-sky-100 bg-sky-50 p-3 text-sky-700 shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold tracking-tight text-slate-950">
            {title}
          </h2>
          <p className="text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>
      {action ? <div className="sm:pt-1">{action}</div> : null}
    </div>
  );
}

function StatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  tone: string;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
            {label}
          </p>
          <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
        </div>
        <div className={cn("rounded-2xl border p-2.5", tone)}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}

function PreviewCard({
  label,
  src,
  alt,
  square = false,
}: {
  label: string;
  src?: string;
  alt: string;
  square?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
        {label}
      </p>
      <div
        className={cn(
          "mt-4 flex items-center justify-center h-45 w-full overflow-hidden rounded-2xl border border-dashed border-slate-200 bg-slate-50",
          square ? "aspect-square" : "aspect-auto",)}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            height={250}
            width={250}
            className={cn(
              "object-cover p-4",
            )}
          />
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 text-center text-slate-400">
            <ImageIcon className="h-5 w-5" />
            <span className="text-xs font-medium">No asset uploaded yet</span>
          </div>
        )}
      </div>
    </div>
  );
}

function UploadHint({ text }: { text: string }) {
  return <p className="text-xs leading-5 text-slate-400">{text}</p>;
}

const ConfigurationForm = ({ data }: ConfigurationFormProps) => {
  const router = useRouter();

  const form = useForm<Configuration>({
    resolver: zodResolver(configurationSchema),
    defaultValues: data || {
      name: "",
      logo: "",
      favicon: "",
      email: "",
      password: "",
    },
  });

  const [isPending, startTransition] = React.useTransition();

  const watchedName = useWatch({ control: form.control, name: "name" });
  const watchedEmail = useWatch({ control: form.control, name: "email" });
  const companyName = watchedName || data?.name || "Your Workspace";
  const supportEmail =
    watchedEmail || data?.email || "No support inbox configured";
  const hasBranding = Boolean(data?.logo || data?.favicon);

  function onSubmit(values: Configuration) {
    startTransition(async () => {
      const formData = new FormData();
      formData.append("id", data?.id || "");
      formData.append("name", values.name || "");
      formData.append("email", values.email || "");
      formData.append("password", values.password || "");
      formData.append(
        "existingLogo",
        typeof data?.logo === "string" ? data.logo : "",
      );
      formData.append(
        "existingFavicon",
        typeof data?.favicon === "string" ? data.favicon : "",
      );

      if (values.logo instanceof File) {
        formData.append("logo", values.logo);
      }

      if (values.favicon instanceof File) {
        formData.append("favicon", values.favicon);
      }

      const res = await saveConfigurationFromForm(formData);

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
    });
  }

  return (
    <div className="min-h-screen space-y-6 bg-[linear-gradient(180deg,#f8fbff_0%,#f4f7fb_100%)] px-4 py-6 text-slate-900 sm:px-6 lg:px-8">
      <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.14),_transparent_28%),linear-gradient(135deg,_#ffffff,_#f8fbff_55%,_#eef5ff)] px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-sky-700">
                Workspace Control
              </p>
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">
                Configuration Center
              </h1>
              <p className="max-w-2xl text-sm leading-7 text-slate-600 sm:text-[15px]">
                Manage company identity, platform branding, and notification
                credentials from a cleaner admin workspace aligned with the
                project&apos;s light-blue SaaS theme.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[560px]">
              <StatTile
                label="Workspace"
                value={companyName}
                icon={Building2}
                tone="border-sky-100 bg-sky-50 text-sky-700"
              />
              <StatTile
                label="Brand Assets"
                value={hasBranding ? "Configured" : "Pending setup"}
                icon={Palette}
                tone="border-indigo-100 bg-indigo-50 text-indigo-700"
              />
              <StatTile
                label="Support Email"
                value={supportEmail}
                icon={Mail}
                tone="border-emerald-100 bg-emerald-50 text-emerald-700"
              />
            </div>
          </div>
        </div>
      </section>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            <div className="min-w-0 space-y-6">
              <Card className="overflow-hidden rounded-[30px] border-slate-200 shadow-sm">
                <CardContent className="space-y-8 p-6 sm:p-8">
                  <SectionHeader
                    title="Organization identity"
                    description="Define the company name and visual assets shown across the app shell, login views, and branded surfaces."
                    icon={Globe}
                    action={
                      <Button
                        type="submit"
                        disabled={isPending}
                        className="h-11 rounded-2xl bg-sky-600 px-5 text-white shadow-sm hover:bg-sky-700"
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {isPending ? "Saving..." : "Save Configuration"}
                      </Button>
                    }
                  />

                  <div className="grid gap-6 lg:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem className="lg:col-span-2">
                          <FormLabel className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Workspace Name
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Enter company or workspace name"
                              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="logo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Primary Logo
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="file"
                              accept="image/*"
                              className="h-12 rounded-2xl border-slate-200 bg-slate-50 file:mr-4 file:rounded-xl file:border-0 file:bg-sky-100 pt-2 file:px-3 file:text-sm file:font-medium file:text-sky-700"
                              onChange={(e) => {
                                field.onChange(e.target.files?.[0]);
                              }}
                            />
                          </FormControl>
                          <UploadHint text="Use a clean PNG or SVG-style asset with transparent background for the sidebar and login screens." />
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="favicon"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Browser Favicon
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="file"
                              accept="image/*"
                              className="h-12 rounded-2xl border-slate-200 bg-slate-50 file:mr-4 file:rounded-xl file:border-0 file:bg-indigo-100 file:px-3 pt-2  file:text-sm file:font-medium file:text-indigo-700"
                              onChange={(e) => {
                                field.onChange(e.target.files?.[0]);
                              }}
                            />
                          </FormControl>
                          <UploadHint text="Upload a small square icon that stays legible in browser tabs and bookmarks." />
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden rounded-[30px] border-slate-200 shadow-sm">
                <CardContent className="space-y-8 p-6 sm:p-8">
                  <SectionHeader
                    title="Email and notification credentials"
                    description="Keep the primary sender inbox and password current so system communication and delivery flows stay reliable."
                    icon={BellRing}
                  />

                  <div className="grid gap-6 lg:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            Sender Email
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="Enter support or sender email"
                              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                            App Password
                          </FormLabel>
                          <FormControl>
                            <Input
                              type="password"
                              placeholder={
                                data?.passwordConfigured
                                  ? "A password is saved. Enter a new one to replace it."
                                  : "Enter email app password"
                              }
                              className="h-12 rounded-2xl border-slate-200 bg-slate-50"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="min-w-0 space-y-6">
              <Card className="overflow-hidden rounded-[30px] border border-slate-200 shadow-sm">
                <CardContent className="p-6 sm:p-8">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Brand Preview
                    </p>
                    <h3 className="text-lg font-semibold tracking-tight text-slate-950">
                      Visual assets
                    </h3>
                    <p className="text-sm leading-6 text-slate-500">
                      Preview the current logo and favicon already configured
                      for your workspace experience.
                    </p>
                  </div>

                  <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                    <PreviewCard
                      label="Logo Preview"
                      src={typeof data?.logo === "string" ? data.logo : undefined}
                      alt="Configured logo"
                    />
                    <PreviewCard
                      label="Favicon Preview"
                      src={
                        typeof data?.favicon === "string"
                          ? data.favicon
                          : undefined
                      }
                      alt="Configured favicon"
                      square
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default ConfigurationForm;
