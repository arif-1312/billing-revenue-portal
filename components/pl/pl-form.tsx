"use client";

import { useEffect, useState, useTransition } from "react";
import {
  useForm,
  SubmitHandler,
  useFieldArray,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import moment from "moment";
import { ArrowRight, CalendarIcon, Loader2 } from "lucide-react";
import { z } from "zod";
import { OrderType, Status } from "@prisma/client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent } from "../ui/card";
import {
  ThemedFormSection,
  themedFieldClassName,
  themedInputClassName,
  themedLabelClassName,
  themedSelectTriggerClassName,
  themedSubmitButtonClassName,
} from "../ui/form-theme";
import { FormHydrationFallback } from "../ui/form-hydration-fallback";
import { cn } from "@/lib/utils";
import { projectSchema } from "@/lib/validators";
import { plDefaultValues } from "@/lib/constants";
import { BillingPlan, Company, Project as ProjectType } from "@/types";
import { createProject, updateProject } from "@/lib/actions/project";
import PLBillingCycle from "./pl-billing-cycle";
import {
  formatBillingCycleLabel,
  generateProjectBillingCycles,
} from "@/lib/billing-cycle-utils";
import { useHydrated } from "@/hooks/use-hydrated";

type ProjectFormValues = z.output<typeof projectSchema>;

const dateButtonClassName = (hasValue?: boolean) =>
  cn(
    themedSelectTriggerClassName,
    "justify-start text-left font-normal",
    !hasValue && "text-muted-foreground",
  );

type BillingCycleSeed = {
  id?: string;
  month?: number | string | null;
  year?: number | string | null;
  billedAmount?: number | string | null;
  billableAmount?: number | string | null;
  fms?: number | string | null;
  spare?: number | string | null;
  resourceUsed?: number | string | null;
  otherCost?: unknown;
};

const normalizeOtherCost = (value: unknown) => {
  if (Array.isArray(value)) return value;

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  return [];
};

const PLForm = ({
  billingPlans,
  companies,
  data,
  update = false,
  billingCycles,
}: {
  billingPlans: BillingPlan[];
  companies: Company[];
  data?: ProjectType;
  update: boolean;
  billingCycles: BillingCycleSeed[];
}) => {
  const router = useRouter();
  const id = data?.id;
  const isHydrated = useHydrated();

  delete data?.createdAt;
  delete data?.updatedAt;

  if (data) {
    data.billingCycle = billingCycles.map((value) => ({
      id: value.id,
      month: Number(value.month ?? 0),
      year: Number(value.year ?? new Date().getFullYear()),
      billedAmount: value.billedAmount == null ? 0 : Number(value.billedAmount),
      billableAmount:
        value.billableAmount == null ? 0 : Number(value.billableAmount),
      fms: Number(value.fms ?? 0),
      spare: Number(value.spare ?? 0),
      resourceUsed: Number(value.resourceUsed ?? 0),
      otherCost: normalizeOtherCost(value.otherCost),
    }));
  }

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema) as Resolver<ProjectFormValues>,
    defaultValues: (data ?? plDefaultValues) as ProjectFormValues,
  });

  const [isPending, startTransition] = useTransition();
  const [selectedCycleIndex, setSelectedCycleIndex] = useState(0);
  const startDate = form.watch("startDate");
  const endDate = form.watch("endDate");
  const billingPlanId = form.watch("billingPlanId");
  const poValue = form.watch("poValue");

  const { fields } = useFieldArray({
    control: form.control,
    name: "billingCycle",
  });

  const onSubmit: SubmitHandler<ProjectFormValues> = (values) => {
    startTransition(async () => {
      const res =
        update && id
          ? await updateProject(values, id)
          : await createProject(values);

      if (!res?.success) {
        toast.error("Error", { description: res?.message });
      } else {
        router.push("/admin/pl");
      }
    });
  };

  const watchedBillingCycles =
    useWatch({
      control: form.control,
      name: "billingCycle",
    }) ?? [];
  const activeCycleIndex =
    fields.length === 0 ? 0 : Math.min(selectedCycleIndex, fields.length - 1);

  useEffect(() => {
    if (update) return;
    if (!billingPlanId || !startDate || !endDate) return;

    const start = moment(startDate);
    const end = moment(endDate);

    if (!start.isValid() || !end.isValid() || end.isBefore(start, "day")) {
      return;
    }

    const selectedPlan = billingPlans.find((item) => item.id === billingPlanId);

    if (!selectedPlan) return;

    const generatedCycles = generateProjectBillingCycles({
      startDate: start.toDate(),
      endDate: end.toDate(),
      totalBillingCycles: Number(selectedPlan.totalBillingCycles || 0),
      planName: selectedPlan.name,
      type: selectedPlan.billingCycleType ?? "START",
    });
    const amountPerCycle =
      generatedCycles.length > 0
        ? Math.floor(Number(poValue || 0) / generatedCycles.length)
        : 0;
    const existingCycles = form.getValues("billingCycle") ?? [];
    const cycles = generatedCycles.map((generatedCycle) => {
      const existingCycle = existingCycles.find(
        (cycle) =>
          Number(cycle?.month ?? -1) === generatedCycle.month &&
          Number(cycle?.year ?? -1) === generatedCycle.year,
      );

      return {
        id: existingCycle?.id,
        month: generatedCycle.month,
        year: generatedCycle.year,
        billedAmount: Number(existingCycle?.billedAmount ?? 0),
        fms: Number(existingCycle?.fms ?? 0),
        spare: Number(existingCycle?.spare ?? 0),
        billableAmount: Number(existingCycle?.billableAmount ?? amountPerCycle),
        resourceUsed: Number(existingCycle?.resourceUsed ?? 0),
        otherCost: normalizeOtherCost(existingCycle?.otherCost),
      };
    });

    form.setValue("billingCycle", cycles);
  }, [billingPlanId, startDate, endDate, poValue, form, billingPlans, update]);

  useEffect(() => {
    if (selectedCycleIndex > fields.length - 1) {
      setSelectedCycleIndex(Math.max(fields.length - 1, 0));
    }
  }, [fields.length, selectedCycleIndex]);

  if (!isHydrated) {
    return (
      <FormHydrationFallback
        fields={6}
        sections={1}
        hasTabs={true}
        submitWidthClassName="w-40"
      />
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-6"
      >
        <Tabs defaultValue="general" className="w-full">
          <TabsList
            className="
            inline-flex h-14 items-center gap-2 rounded-2xl
            bg-gradient-to-r from-sky-50 to-blue-100
            p-2 shadow-sm border border-sky-200
            "
          >
            <TabsTrigger
              value="general"
              className="
              rounded-xl px-6 py-2.5 text-sm font-semibold
              text-slate-600 transition-all duration-300
              hover:bg-white hover:text-slate-900
              data-[state=active]:bg-white
              data-[state=active]:text-sky-600
              data-[state=active]:shadow-md
              data-[state=active]:scale-[1.02]
              "
            >
              General
            </TabsTrigger>

            <TabsTrigger
              value="billing-cycle"
              className="
              rounded-xl px-6 py-2.5 text-sm font-semibold
              text-slate-600 transition-all duration-300
              hover:bg-white hover:text-slate-900
              data-[state=active]:bg-white
              data-[state=active]:text-sky-600
              data-[state=active]:shadow-md
              data-[state=active]:scale-[1.02]
              "
            >
              Billing Cycle
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="mt-6">
            <ThemedFormSection title="Project Details">
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="companyId"
                  render={({ field }) => (
                    <FormItem className={themedFieldClassName}>
                      <FormLabel className={themedLabelClassName}>
                        Company Name
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            className={themedSelectTriggerClassName}
                          >
                            <SelectValue placeholder="Company Name" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {companies.map((company) => (
                                <SelectItem
                                  value={company.id ?? ""}
                                  key={company.id}
                                >
                                  {company.name}
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
                  name="projectName"
                  render={({ field }) => (
                    <FormItem className={themedFieldClassName}>
                      <FormLabel className={themedLabelClassName}>
                        Project Name
                      </FormLabel>
                      <FormControl>
                        <Input
                          className={themedInputClassName}
                          placeholder="Enter project name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem className={themedFieldClassName}>
                      <FormLabel className={themedLabelClassName}>
                        Start Date
                      </FormLabel>
                      <FormControl>
                        <Popover>
                          <PopoverTrigger disabled={update} asChild>
                            <Button
                              variant="outline"
                              className={dateButtonClassName(!!field.value)}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            avoidCollisions={false}
                            className="w-auto p-0"
                            side="bottom"
                            sideOffset={8}
                          >
                            <Calendar
                              mode="single"
                              selected={field.value as Date}
                              onSelect={(date) => field.onChange(date)}
                              disabled={update}
                            />
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem className={themedFieldClassName}>
                      <FormLabel className={themedLabelClassName}>
                        End Date
                      </FormLabel>
                      <FormControl>
                        <Popover>
                          <PopoverTrigger disabled={update} asChild>
                            <Button
                              variant="outline"
                              className={dateButtonClassName(!!field.value)}
                            >
                              <CalendarIcon className="mr-2 h-4 w-4" />
                              {field.value ? (
                                format(field.value, "PPP")
                              ) : (
                                <span>Pick a date</span>
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            align="start"
                            avoidCollisions={false}
                            className="w-auto p-0"
                            side="bottom"
                            sideOffset={8}
                          >
                            <Calendar
                              mode="single"
                              selected={field.value as Date}
                              onSelect={field.onChange}
                              disabled={update}
                            />
                          </PopoverContent>
                        </Popover>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="poValue"
                  render={({ field }) => (
                    <FormItem className={themedFieldClassName}>
                      <FormLabel className={themedLabelClassName}>
                        PO Value
                      </FormLabel>
                      <FormControl>
                        <Input
                          className={themedInputClassName}
                          type="number"
                          placeholder="Enter PO Value"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="billingPlanId"
                  render={({ field }) => (
                    <FormItem className={themedFieldClassName}>
                      <FormLabel className={themedLabelClassName}>
                        Billing Plan
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value ?? ""}
                          onValueChange={field.onChange}
                          disabled={update}
                        >
                          <SelectTrigger
                            className={themedSelectTriggerClassName}
                          >
                            <SelectValue placeholder="Billing plan" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {billingPlans.map((billing) => (
                                <SelectItem
                                  value={billing.id ?? ""}
                                  key={billing.id}
                                >
                                  {billing.name}
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
                  name="resourceCount"
                  render={({ field }) => (
                    <FormItem className={themedFieldClassName}>
                      <FormLabel className={themedLabelClassName}>
                        Resource Count
                      </FormLabel>
                      <FormControl>
                        <Input
                          className={themedInputClassName}
                          type="number"
                          placeholder="Enter Resource Count"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="projectedProfit"
                  render={({ field }) => (
                    <FormItem className={themedFieldClassName}>
                      <FormLabel className={themedLabelClassName}>
                        Projected Profit Percentage
                      </FormLabel>
                      <FormControl>
                        <Input
                          className={themedInputClassName}
                          type="number"
                          placeholder="Enter Projected Profit"
                          {...field}
                          onChange={(e) =>
                            field.onChange(Number(e.target.value))
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="orderType"
                  render={({ field }) => (
                    <FormItem className={themedFieldClassName}>
                      <FormLabel className={themedLabelClassName}>
                        Order Type
                      </FormLabel>
                      <FormControl>
                        <Select
                          value={field.value}
                          onValueChange={field.onChange}
                        >
                          <SelectTrigger
                            className={themedSelectTriggerClassName}
                          >
                            <SelectValue placeholder="Order type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {Object.values(OrderType).map((status) => (
                                <SelectItem value={status} key={status}>
                                  {status}
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
                            <SelectValue placeholder="Status" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {Object.values(Status).map((status) => (
                                <SelectItem value={status} key={status}>
                                  {status}
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
              </div>
            </ThemedFormSection>
          </TabsContent>

          <TabsContent value="billing-cycle" className="mt-6">
            {/* <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {fields.map((field, index) => (
                <Card key={index} className={billingCardClassName}>
                 
                  <CardContent>
                    <PLBillingCycle field={field} index={index} form={form} />
                  </CardContent>
                </Card>
              ))}
            </div>
            {!fields.length ? (
              <div className={cn(themedSectionClassName, "mt-4 text-center text-slate-500")}>
                Billing cycles will appear here once the project dates and billing plan are selected.
              </div>
            ) : null} */}
            {fields.length > 0 ? (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-3">
                  {fields.map((field, index) => (
                    <Button
                      key={field.id}
                      type="button"
                      variant={
                        activeCycleIndex === index ? "default" : "outline"
                      }
                      className="min-w-[120px] justify-start px-4"
                      onClick={() => setSelectedCycleIndex(index)}
                    >
                      {formatBillingCycleLabel(
                        undefined,
                        watchedBillingCycles[index]?.month,
                        watchedBillingCycles[index]?.year,
                      )}
                    </Button>
                  ))}
                </div>

                <Card className="shadow-md rounded-xl border">
                  <CardContent>
                    <PLBillingCycle
                      key={
                        fields[activeCycleIndex]?.id ??
                        `${activeCycleIndex}-${watchedBillingCycles[activeCycleIndex]?.month}-${watchedBillingCycles[activeCycleIndex]?.year}`
                      }
                      field={fields[activeCycleIndex]}
                      index={activeCycleIndex}
                      form={form}
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border border-dashed border-sky-200 bg-gradient-to-b from-white to-sky-50/70 shadow-[0_20px_52px_-34px_rgba(14,165,233,0.32)]">
                <CardContent className="py-10 text-center text-slate-500">
                  No billing cycles generated yet.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

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
            Save Project
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default PLForm;
