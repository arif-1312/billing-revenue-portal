"use client";

import React, { useState, useEffect } from "react";
import {
  useForm,
  useFieldArray,
  SubmitHandler,
  useWatch,
  type Resolver,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import moment from "moment";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import BillingCycleForm from "./billing-cycle-form";
import { Calendar } from "../ui/calendar";
import { Loader2, ArrowRight, CalendarIcon, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  themedFieldClassName,
  themedInputClassName,
  themedLabelClassName,
  themedSectionClassName,
  themedSelectTriggerClassName,
  themedSubmitButtonClassName,
  themedTabsListClassName,
  themedTextareaClassName,
} from "@/components/ui/form-theme";

import { purchaseOrderSchema } from "@/lib/validators";
import {
  createPurchaseOrder,
  updatePurchaseOrder,
} from "@/lib/actions/purschase-order";
import { POStatus, PaymentReceived, PurchaseOrderType } from "@prisma/client";
import {
  BillingPlan,
  Company,
  ContractDuration,
  ContractType,
  Customer,
  ServiceType,
  Vendor,
} from "@/types";
import z from "zod";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { Card, CardContent } from "../ui/card";
import { Skeleton } from "../ui/skeleton";
import {
  formatBillingCycleLabel,
  MONTH_NAMES,
  generatePurchaseOrderBillingCycles,
  resolveBillingPlanInterval,
  resolveCycleInvoiceAmount,
} from "@/lib/billing-cycle-utils";

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;
type PurchaseOrderFormData = Partial<PurchaseOrderFormValues> & {
  billingCycles?: Array<
    Partial<PurchaseOrderFormValues["billingCycles"][number]>
  >;
  companyId?: string | null;
  vendorId?: string | null;
  id?: string;
  status?: POStatus;
};

const dateButtonClassName = (hasValue?: boolean) =>
  cn(
    themedSelectTriggerClassName,
    "justify-start text-left font-normal",
    !hasValue && "text-muted-foreground",
  );

const formCardClassName =
  "overflow-hidden rounded-2xl border border-sky-100/90 bg-[linear-gradient(180deg,rgba(255,255,255,1),rgba(248,252,255,0.95))] shadow-[0_24px_70px_-40px_rgba(15,23,42,0.24)] transition-all duration-200 hover:shadow-[0_28px_74px_-36px_rgba(14,165,233,0.22)]";

const defaultPurchaseOrderValues: PurchaseOrderFormValues = {
  customerPONumber: "",
  poAmount: 0,
  serviceTypeId: "",
  contractDurationId: "",
  contractId: "",
  paymentTerms: "",
  billingPlanId: "",
  customerId: "",
  vendorId: "",
  poOwner: "",
  status: POStatus.LIVE,
  purchaseOrderType: undefined,
  startFrom: undefined,
  endDate: undefined,
  ageingDays: 0,
  remark: "",
  scope: "",
  billingCycles: [],
};

type PurchaseOrderBillingCycle =
  PurchaseOrderFormValues["billingCycles"][number];

const normalizePurchaseOrderType = (value?: string | null) => {
  if (typeof value !== "string") return undefined;

  const normalized = value.trim().toUpperCase();

  return Object.values(PurchaseOrderType).includes(
    normalized as PurchaseOrderType,
  )
    ? (normalized as PurchaseOrderType)
    : undefined;
};

const supportsManualPurchaseOrderBillingCycles = (
  purchaseOrderType?: PurchaseOrderType,
) =>
  purchaseOrderType === PurchaseOrderType.MAIL ||
  purchaseOrderType === PurchaseOrderType.AGREEMENT;

const getManualBillingCycleAnchorDate = (
  startDate?: Date | string | null,
  finishDate?: Date | string | null,
) => {
  const startMoment = startDate ? moment(startDate) : null;

  if (startMoment?.isValid()) {
    return startMoment.startOf("day").toDate();
  }

  const endMoment = finishDate ? moment(finishDate) : null;

  if (endMoment?.isValid()) {
    return endMoment.startOf("day").toDate();
  }

  return undefined;
};

const areDatesEquivalent = (
  first?: Date | string | null,
  second?: Date | string | null,
) => {
  if (!first && !second) return true;
  if (!first || !second) return false;

  const firstDate = moment(first);
  const secondDate = moment(second);

  if (!firstDate.isValid() || !secondDate.isValid()) {
    return String(first) === String(second);
  }

  return firstDate.isSame(secondDate, "day");
};

const getCycleMonthYear = (cycle?: PurchaseOrderBillingCycle) => {
  const cycleDate = cycle?.invoiceDate ?? cycle?.billingSubmittedDate;

  if (!cycleDate) return null;

  const value = new Date(cycleDate);

  if (Number.isNaN(value.getTime())) return null;

  return {
    month: value.getMonth(),
    year: value.getFullYear(),
  };
};

const getDefaultPaymentDueDate = (
  cycle?: Partial<PurchaseOrderBillingCycle> | null,
) => {
  return (
    cycle?.paymentDueDate ??
    cycle?.invoiceDate ??
    cycle?.billingSubmittedDate ??
    null
  );
};

const paymentDrafts = (cycle?: {
  collectedAmount?: number | null;
  paymentReceivedDate?: Date | string | null;
  payments?: Array<{
    id?: string;
    receivedDate?: Date | string | null;
    amount?: number | null;
  }> | null;
} | null) => {
  const stored = cycle?.payments ?? [];

  if (stored.length > 0) {
    return stored.map((payment) => ({
      id: payment.id,
      receivedDate: payment.receivedDate ? new Date(payment.receivedDate) : null,
      amount: Number(payment.amount ?? 0),
    }));
  }

  if (cycle?.paymentReceivedDate) {
    return [
      {
        receivedDate: new Date(cycle.paymentReceivedDate),
        amount: Number(cycle.collectedAmount ?? 0),
      },
    ];
  }

  return [];
};

const getBillingSubmittedDate = (
  cycle?: Partial<PurchaseOrderBillingCycle> | null,
  anchorDate?: Date | null,
) => {
  return (
    cycle?.invoiceDate ??
    cycle?.billingSubmittedDate ??
    anchorDate ??
    undefined
  );
};

const createBillingCycleDraft = ({
  existingCycle,
  anchorDate,
  invoiceAmount = 0,
  preserveInvoiceAmount = true,
}: {
  existingCycle?: Partial<PurchaseOrderBillingCycle> | null;
  anchorDate?: Date | null;
  invoiceAmount?: number;
  preserveInvoiceAmount?: boolean;
}): PurchaseOrderBillingCycle => ({
  id: existingCycle?.id,
  invoiceNumber: existingCycle?.invoiceNumber ?? "",
  invoiceAmount: preserveInvoiceAmount
    ? Number(existingCycle?.invoiceAmount ?? invoiceAmount)
    : Number(invoiceAmount),
  collectedAmount: Number(existingCycle?.collectedAmount ?? 0),
  invoiceDate:
    existingCycle?.invoiceDate ??
    existingCycle?.billingSubmittedDate ??
    anchorDate ??
    undefined,
  billingSubmittedDate: getBillingSubmittedDate(existingCycle, anchorDate),
  paymentReceived: existingCycle?.paymentReceived ?? PaymentReceived.NO,
  paymentReceivedDate: existingCycle?.paymentReceivedDate ?? null,
  payments: paymentDrafts(existingCycle),
  paymentDueDate:
    getDefaultPaymentDueDate(existingCycle) ?? anchorDate ?? null,
  billingRemark: existingCycle?.billingRemark ?? "",
  tds: Number(existingCycle?.tds ?? 0),
});

const getDateFromMonthYear = (month: number, year: number) =>
  new Date(year, month, 1);

const distributeInvoiceAmounts = (
  totalAmount: number | string | null | undefined,
  cycleCount: number,
) => {
  if (cycleCount <= 0) return [];

  const totalInPaise = Math.round(Number(totalAmount ?? 0) * 100);
  const baseAmountInPaise = Math.floor(totalInPaise / cycleCount);
  const remainderInPaise = totalInPaise % cycleCount;

  return Array.from({ length: cycleCount }, (_, index) => {
    const nextAmountInPaise =
      baseAmountInPaise + (index < remainderInPaise ? 1 : 0);

    return nextAmountInPaise / 100;
  });
};

const isOTSContractType = (name?: string | null) => {
  const normalizedName = name?.trim().toLowerCase() ?? "";

  return (
    normalizedName === "ots" ||
    /\bots\b/.test(normalizedName) ||
    normalizedName.includes("one time") ||
    normalizedName.includes("one-time") ||
    normalizedName.includes("onetime")
  );
};

const POForm = ({
  billingPlan,
  serviceType,
  contractType,
  customers,
  vendors,
  companies,
  data,
  update = false,
  contractDurations,
}: {
  billingPlan: BillingPlan[];
  serviceType: ServiceType[];
  contractType: ContractType[];
  customers: Customer[];
  vendors: Vendor[];
  companies: Company[];
  data?: PurchaseOrderFormData;
  update: boolean;
  contractDurations: ContractDuration[];
}) => {
  const router = useRouter();
  const id = data?.id;
  const isMounted = React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  // ---------------- FORM ----------------
  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema) as Resolver<PurchaseOrderFormValues>,
    defaultValues: {
      ...(data ?? defaultPurchaseOrderValues),
      purchaseOrderType: normalizePurchaseOrderType(data?.purchaseOrderType),
    } as PurchaseOrderFormValues,
  });

  const { fields, append, remove, replace } = useFieldArray({
    control: form.control,
    name: "billingCycles",
  });

  const [selectedCycleIndex, setSelectedCycleIndex] = useState(0);
  const [isAddCycleDialogOpen, setIsAddCycleDialogOpen] = useState(false);

  // ---------------- WATCHERS ----------------
  const [
    watchBillingPlan,
    watchPOAmount,
    watchContractId,
    startFrom,
    endDate,
    watchPurchaseOrderType,
  ] = useWatch({
    control: form.control,
    name: [
      "billingPlanId",
      "poAmount",
      "contractId",
      "startFrom",
      "endDate",
      "purchaseOrderType",
    ],
  });
  const watchedBillingCycles =
    useWatch({
      control: form.control,
      name: "billingCycles",
    }) ?? [];
  const activeCycleIndex =
    fields.length === 0
      ? 0
      : Math.min(selectedCycleIndex, fields.length - 1);
  const defaultCycleAnchorDate = React.useMemo(
    () => getManualBillingCycleAnchorDate(startFrom, endDate) ?? new Date(),
    [endDate, startFrom],
  );
  const [pendingCycleMonth, setPendingCycleMonth] = useState(
    defaultCycleAnchorDate.getMonth().toString(),
  );
  const [pendingCycleYear, setPendingCycleYear] = useState(
    defaultCycleAnchorDate.getFullYear().toString(),
  );
  const selectedContractType = React.useMemo(
    () =>
      contractType.find(
        (value) => String(value.id) === String(watchContractId ?? ""),
      ),
    [contractType, watchContractId],
  );
  const isOTSSelected = React.useMemo(
    () => isOTSContractType(selectedContractType?.name),
    [selectedContractType?.name],
  );
  const isManualPurchaseOrderType = React.useMemo(
    () => supportsManualPurchaseOrderBillingCycles(watchPurchaseOrderType),
    [watchPurchaseOrderType],
  );
  const selectedBillingPlan = React.useMemo(
    () =>
      billingPlan.find(
        (value) => String(value.id) === String(watchBillingPlan ?? ""),
      ) ?? null,
    [billingPlan, watchBillingPlan],
  );
  const isFlexibleBillingPlan = React.useMemo(() => {
    if (!selectedBillingPlan) return false;

    return !resolveBillingPlanInterval(
      Number(selectedBillingPlan.totalBillingCycles || 0),
      selectedBillingPlan.name,
    ).autoGenerate;
  }, [selectedBillingPlan]);
  const canManageManualBillingCycles = React.useMemo(
    () => isOTSSelected || isManualPurchaseOrderType || isFlexibleBillingPlan,
    [isFlexibleBillingPlan, isManualPurchaseOrderType, isOTSSelected],
  );
  const canEditInvoiceAmount = React.useMemo(
    () =>
      canManageManualBillingCycles ||
      watchPurchaseOrderType === PurchaseOrderType.NORMAL,
    [canManageManualBillingCycles, watchPurchaseOrderType],
  );
  const isInitialUpdateGenerationState = React.useMemo(() => {
    if (!update || !data) return false;

    return (
      String(watchBillingPlan ?? "") === String(data.billingPlanId ?? "") &&
      Number(watchPOAmount ?? 0) === Number(data.poAmount ?? 0) &&
      String(watchContractId ?? "") === String(data.contractId ?? "") &&
      normalizePurchaseOrderType(watchPurchaseOrderType) ===
        normalizePurchaseOrderType(data.purchaseOrderType) &&
      areDatesEquivalent(startFrom, data.startFrom) &&
      areDatesEquivalent(endDate, data.endDate)
    );
  }, [
    data,
    endDate,
    startFrom,
    update,
    watchBillingPlan,
    watchContractId,
    watchPOAmount,
    watchPurchaseOrderType,
  ]);

  const [isPending, startTransition] = React.useTransition();
  const skipInitialAutoGenerationRef = React.useRef(update);
  const lastGeneratedInvoiceAmountsRef = React.useRef(new Map<string, number>());

  const billingCycleYearOptions = React.useMemo(() => {
    const years = new Set<number>([
      defaultCycleAnchorDate.getFullYear(),
      defaultCycleAnchorDate.getFullYear() + 1,
      defaultCycleAnchorDate.getFullYear() + 2,
    ]);

    const startYear = startFrom ? moment(startFrom).year() : null;
    const endYear = endDate ? moment(endDate).year() : null;

    if (startYear) years.add(startYear);
    if (endYear) years.add(endYear);

    return Array.from(years)
      .sort((firstYear, secondYear) => firstYear - secondYear)
      .map((year) => year.toString());
  }, [defaultCycleAnchorDate, endDate, startFrom]);

  const openAddBillingCycleDialog = React.useCallback(() => {
    setPendingCycleMonth(defaultCycleAnchorDate.getMonth().toString());
    setPendingCycleYear(defaultCycleAnchorDate.getFullYear().toString());
    setIsAddCycleDialogOpen(true);
  }, [defaultCycleAnchorDate]);

  const addManualBillingCycle = React.useCallback(() => {
    const selectedMonth = Number(pendingCycleMonth);
    const selectedYear = Number(pendingCycleYear);

    if (Number.isNaN(selectedMonth) || Number.isNaN(selectedYear)) {
      toast.error("Select billing month and year");
      return;
    }

    const anchorDate = getDateFromMonthYear(selectedMonth, selectedYear);
    const existingCycles = form.getValues("billingCycles") ?? [];
    const cycleAlreadyExists = existingCycles.some((cycle) => {
      const cycleMonthYear = getCycleMonthYear(cycle);

      return (
        cycleMonthYear?.month === selectedMonth &&
        cycleMonthYear?.year === selectedYear
      );
    });

    if (cycleAlreadyExists) {
      toast.error("Billing cycle already exists for that month and year");
      return;
    }

    const nextIndex = fields.length;

    append(
      createBillingCycleDraft({
        anchorDate,
        invoiceAmount: 0,
      }),
    );
    setSelectedCycleIndex(nextIndex);
    setIsAddCycleDialogOpen(false);
  }, [append, fields.length, form, pendingCycleMonth, pendingCycleYear]);

  const removeManualBillingCycle = React.useCallback(
    (index: number) => {
      const cycleCount = form.getValues("billingCycles")?.length ?? 0;

      if (cycleCount <= 1) return;

      remove(index);
      setSelectedCycleIndex((currentIndex) => {
        if (currentIndex === index) {
          return Math.max(0, index - 1);
        }

        if (currentIndex > index) {
          return currentIndex - 1;
        }

        return currentIndex;
      });
    },
    [form, remove],
  );

  useEffect(() => {
    if (!canManageManualBillingCycles) return;

    const existingCycles = form.getValues("billingCycles") ?? [];

    if (existingCycles.length > 0) return;

    const anchorDate = getManualBillingCycleAnchorDate(startFrom, endDate);

    if (!anchorDate) return;

    replace([
      createBillingCycleDraft({
        anchorDate,
        invoiceAmount: Number(watchPOAmount ?? 0),
      }),
    ]);
  }, [
    canManageManualBillingCycles,
    endDate,
    form,
    replace,
    startFrom,
    watchPOAmount,
  ]);

  useEffect(() => {
    if (startFrom && endDate) {
      const days = moment(endDate).diff(moment(startFrom), "days") + 1;

      form.setValue("ageingDays", days >= 0 ? days : 0);
    } else {
      form.setValue("ageingDays", 0);
    }
  }, [endDate, form, startFrom]);

  useEffect(() => {
    if (!canManageManualBillingCycles) return;

    const existingCycles = form.getValues("billingCycles") ?? [];

    if (existingCycles.length === 0) {
      return;
    }

    const anchorDate = getManualBillingCycleAnchorDate(startFrom, endDate);
    const normalizedCycles = existingCycles.map((cycle) =>
      createBillingCycleDraft({
        existingCycle: cycle,
        anchorDate,
        invoiceAmount: Number(cycle?.invoiceAmount ?? 0),
      }),
    );

    replace(normalizedCycles);
  }, [
    canManageManualBillingCycles,
    endDate,
    form,
    replace,
    startFrom,
  ]);

  // ---------------- SUBMIT ----------------
  const onSubmit: SubmitHandler<PurchaseOrderFormValues> = (values) => {
    startTransition(async () => {
      const res =
        update && id
          ? await updatePurchaseOrder(values, id)
          : await createPurchaseOrder(values);

      if (!res?.success) {
        toast.error("Error", { description: res?.message });
      } else {
        router.push("/admin/revenue");
      }
    });
  };

  // ---------------- AUTO BILLING CYCLES ----------------
  useEffect(() => {
    if (isManualPurchaseOrderType) return;
    if (!watchBillingPlan || watchPOAmount == null || !startFrom || !endDate) {
      return;
    }

    const start = moment(startFrom);
    const end = moment(endDate);

    if (!start.isValid() || !end.isValid() || end.isBefore(start, "day")) {
      return;
    }

    const selectedPlan = billingPlan.find(
      (value) => value.id === watchBillingPlan,
    );

    if (!selectedPlan) return;

    const planInterval = resolveBillingPlanInterval(
      Number(selectedPlan.totalBillingCycles || 0),
      selectedPlan.name,
    );

    if (!planInterval.autoGenerate) return;

    const generatedCycles = generatePurchaseOrderBillingCycles({
      startDate: start.toDate(),
      endDate: end.toDate(),
      totalBillingCycles: Number(selectedPlan.totalBillingCycles || 0),
      planName: selectedPlan.name,
      type: selectedPlan.billingCycleType ?? "START",
    });
    const generatedInvoiceAmounts = distributeInvoiceAmounts(
      watchPOAmount,
      generatedCycles.length,
    );
    const trackGeneratedAmounts = () => {
      const tracked = new Map<string, number>();

      generatedCycles.forEach((cycleDates, index) => {
        const targetDate =
          cycleDates.invoiceDate ?? cycleDates.billingSubmittedDate;

        if (!targetDate) return;

        tracked.set(
          `${targetDate.getFullYear()}-${targetDate.getMonth()}`,
          Number(generatedInvoiceAmounts[index] ?? 0),
        );
      });

      lastGeneratedInvoiceAmountsRef.current = tracked;
    };

    if (skipInitialAutoGenerationRef.current) {
      skipInitialAutoGenerationRef.current = false;

      if (isInitialUpdateGenerationState) {
        trackGeneratedAmounts();
        return;
      }
    }

    const existingCycles = form.getValues("billingCycles") ?? [];
    const trackedInvoiceAmounts = new Map<string, number>();

    const cycles = generatedCycles.map((cycleDates, index) => {
      const targetDate = cycleDates.invoiceDate ?? cycleDates.billingSubmittedDate;
      const targetMonth = targetDate.getMonth();
      const targetYear = targetDate.getFullYear();
      const cycleKey = `${targetYear}-${targetMonth}`;
      const existingCycle = existingCycles.find((cycle) => {
        const monthYear = getCycleMonthYear(cycle);

        return (
          monthYear?.month === targetMonth &&
          monthYear?.year === targetYear
        );
      });
      const resolvedInvoiceAmount = resolveCycleInvoiceAmount(
        existingCycle?.invoiceAmount,
        generatedInvoiceAmounts[index] ?? 0,
        lastGeneratedInvoiceAmountsRef.current.get(cycleKey),
      );

      trackedInvoiceAmounts.set(
        cycleKey,
        resolvedInvoiceAmount.trackedGeneratedAmount,
      );

      return {
        id: existingCycle?.id,
        invoiceNumber: existingCycle?.invoiceNumber ?? "",
        invoiceAmount: resolvedInvoiceAmount.amount,
        collectedAmount: Number(existingCycle?.collectedAmount ?? 0),
        invoiceDate:
          existingCycle?.invoiceDate ??
          existingCycle?.billingSubmittedDate ??
          cycleDates.invoiceDate,
        billingSubmittedDate:
          existingCycle?.invoiceDate ??
          existingCycle?.billingSubmittedDate ??
          cycleDates.invoiceDate ??
          cycleDates.billingSubmittedDate,
        paymentReceived: existingCycle?.paymentReceived ?? PaymentReceived.NO,
        paymentReceivedDate: existingCycle?.paymentReceivedDate ?? null,
        payments: paymentDrafts(existingCycle),
        paymentDueDate:
          getDefaultPaymentDueDate(existingCycle) ??
          cycleDates.invoiceDate ??
          cycleDates.billingSubmittedDate ??
          null,
        billingRemark: existingCycle?.billingRemark ?? "",
        tds: Number(existingCycle?.tds ?? 0),
      };
    });

    lastGeneratedInvoiceAmountsRef.current = trackedInvoiceAmounts;
    replace(cycles);
  }, [
    billingPlan,
    endDate,
    form,
    replace,
    startFrom,
    update,
    watchBillingPlan,
    watchContractId,
    watchPOAmount,
    watchPurchaseOrderType,
    isManualPurchaseOrderType,
    isInitialUpdateGenerationState,
  ]);

  // ---------------- UPDATE MODE ----------------
  useEffect(() => {
    if (!update || !data) return;

    skipInitialAutoGenerationRef.current = true;

    const formattedCycles = (data.billingCycles ?? []).map((bc) => {
      return {
        id: bc.id,
        invoiceNumber: bc.invoiceNumber ?? "",
        invoiceAmount: Number(bc.invoiceAmount ?? 0),
        collectedAmount: Number(bc.collectedAmount ?? 0),

        invoiceDate: bc.invoiceDate
          ? new Date(bc.invoiceDate)
          : bc.billingSubmittedDate
            ? new Date(bc.billingSubmittedDate)
            : undefined,
        billingSubmittedDate: bc.invoiceDate
          ? new Date(bc.invoiceDate)
          : bc.billingSubmittedDate
            ? new Date(bc.billingSubmittedDate)
            : undefined,
        paymentReceivedDate: bc.paymentReceivedDate
          ? new Date(bc.paymentReceivedDate)
          : undefined,
        payments: paymentDrafts(bc),
        paymentDueDate: getDefaultPaymentDueDate({
          billingSubmittedDate: bc.billingSubmittedDate
            ? new Date(bc.billingSubmittedDate)
            : undefined,
          invoiceDate: bc.invoiceDate
            ? new Date(bc.invoiceDate)
            : undefined,
          paymentDueDate: bc.paymentDueDate
            ? new Date(bc.paymentDueDate)
            : undefined,
        }) ?? undefined,
        paymentReceived: bc.paymentReceived,
        billingRemark: bc.billingRemark ?? "",
        tds: Number(bc.tds ?? 0),
      };
    });

    form.reset({
      ...defaultPurchaseOrderValues,

      customerPONumber: data.customerPONumber ?? "",
      poAmount: Number(data.poAmount ?? 0),

      serviceTypeId: String(data.serviceTypeId ?? ""),
      contractDurationId: String(data.contractDurationId ?? ""),
      companyId: String(data.companyId ?? ""),
      contractId: String(data.contractId ?? ""),
      billingPlanId: String(data.billingPlanId ?? ""),
      customerId: String(data.customerId ?? ""),
      vendorId: String(data.vendorId ?? ""),

      paymentTerms: data.paymentTerms ?? "",
      poOwner: data.poOwner ?? "",
      status: data.status,
      purchaseOrderType: normalizePurchaseOrderType(data.purchaseOrderType),

      startFrom: data.startFrom ? new Date(data.startFrom) : undefined,
      endDate: data.endDate ? new Date(data.endDate) : undefined,
      ageingDays: Number(data.ageingDays ?? 0),

      remark: data.remark ?? "",
      scope: data.scope ?? "",

      billingCycles: formattedCycles ?? [],
    });

    replace(formattedCycles);
  }, [data, update, form, replace]);

  if (!isMounted) {
    return (
      <div className="space-y-6">
        <div className={themedTabsListClassName}>
          <Skeleton className="h-11 flex-1 rounded-xl md:w-32" />
          <Skeleton className="h-11 flex-1 rounded-xl md:w-36" />
        </div>
        <div className={cn(themedSectionClassName, "grid grid-cols-1 gap-6 md:grid-cols-2")}>
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="space-y-2.5">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-11 w-full rounded-xl" />
            </div>
          ))}
          <div className="space-y-2.5 md:col-span-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-32 w-full rounded-2xl" />
          </div>
        </div>
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit, (errors) => {
          console.log("FORM ERRORS:", errors);
          toast.error("Validation failed");
        })}
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

          {/* ================= GENERAL TAB ================= */}
          <TabsContent value="general" className="mt-6">
            <div className={cn(themedSectionClassName, "grid grid-cols-1 gap-6 md:grid-cols-2")}>
              {/* Purchase Order Type */}
              <FormField
                control={form.control}
                name="purchaseOrderType"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Purchase Order Type</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={(value) => field.onChange(value || undefined)}
                      >
                        <SelectTrigger className={themedSelectTriggerClassName}>
                          <SelectValue placeholder="Select Purchase Order Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            <SelectItem value={PurchaseOrderType.MAIL}>
                              Mail
                            </SelectItem>
                            <SelectItem value={PurchaseOrderType.AGREEMENT}>
                              Agreement
                            </SelectItem>
                            <SelectItem value={PurchaseOrderType.NORMAL}>
                              Normal
                            </SelectItem>
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Customer PO Number */}
              <FormField
                control={form.control}
                name="customerPONumber"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Customer PO Number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Enter Customer PO Number"
                        className={themedInputClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Company */}
              <FormField
                control={form.control}
                name="companyId"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Company</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className={themedSelectTriggerClassName}>
                          <SelectValue placeholder="Select Company" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {companies.map((company) => (
                              <SelectItem
                                key={company.id}
                                value={String(company.id)}
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

              {/* PO Amount */}
              <FormField
                control={form.control}
                name="poAmount"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>PO Amount</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="Enter PO Amount"
                        className={themedInputClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Service Type */}
              <FormField
                control={form.control}
                name="serviceTypeId"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Service Type</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className={themedSelectTriggerClassName}>
                          <SelectValue placeholder="Select Service Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {serviceType.map((service) => (
                              <SelectItem
                                key={service.id}
                                value={String(service.id)}
                              >
                                {service.name}
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

              {/* Contract Duration */}
              <FormField
                control={form.control}
                name="contractDurationId"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Contract Duration</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className={themedSelectTriggerClassName}>
                          <SelectValue placeholder="Contract Duration" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {contractDurations.map((contract) => (
                              <SelectItem
                                key={contract.id}
                                value={String(contract.id)}
                              >
                                {contract.name}
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

              {/* Contract Type */}
              <FormField
                control={form.control}
                name="contractId"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Contract Type</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className={themedSelectTriggerClassName}>
                          <SelectValue placeholder="Contract Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {contractType.map((contract) => (
                              <SelectItem
                                key={contract.id}
                                value={String(contract.id)}
                              >
                                {contract.name}
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

              {/* Start Date */}
              <FormField
                control={form.control}
                name="startFrom"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Start Date</FormLabel>
                    <FormControl>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={dateButtonClassName(!!field.value)}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value
                              ? format(field.value, "PPP")
                              : "Pick a date"}
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
                          />
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* End Date */}
              <FormField
                control={form.control}
                name="endDate"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>End Date</FormLabel>
                    <FormControl>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={dateButtonClassName(!!field.value)}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {field.value
                              ? format(field.value, "PPP")
                              : "Pick a date"}
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
                          />
                        </PopoverContent>
                      </Popover>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Scope */}
              <FormField
                control={form.control}
                name="scope"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Scope Of Work</FormLabel>
                    <FormControl>
                      <Input className={themedInputClassName} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contract Days */}
              <FormField
                control={form.control}
                name="ageingDays"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Contract Days</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        value={field.value ?? 0}
                        readOnly
                        className="h-11 rounded-xl border-sky-200/90 bg-white/95 shadow-[0_14px_34px_-24px_rgba(14,165,233,0.5)] transition-all duration-200 hover:border-sky-300 hover:bg-sky-50/40 hover:shadow-[0_18px_42px_-22px_rgba(14,165,233,0.42)] focus-visible:border-sky-400 focus-visible:ring-4 focus-visible:ring-sky-100 cursor-not-allowed"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Payment Terms */}
              <FormField
                control={form.control}
                name="paymentTerms"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Payment Terms</FormLabel>
                    <FormControl>
                      <Input className={themedInputClassName} placeholder="Enter Payment Terms" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* PO Owner */}
              <FormField
                control={form.control}
                name="poOwner"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>PO Owner</FormLabel>
                    <FormControl>
                      <Input className={themedInputClassName} placeholder="Enter PO Owner" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Billing Plan */}
              <FormField
                control={form.control}
                name="billingPlanId"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Billing Plan</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className={themedSelectTriggerClassName}>
                          <SelectValue placeholder="Select Billing Plan" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {billingPlan.map((bp) => (
                              <SelectItem key={bp.id} value={String(bp.id)}>
                                {bp.name}
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

              {/* Customer */}
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Customer</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className={themedSelectTriggerClassName}>
                          <SelectValue placeholder="Customer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {customers.map((customer) => (
                              <SelectItem
                                key={customer.id}
                                value={String(customer.id)}
                              >
                                {customer.firstName} {customer.lastName}
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

              {/* Vendor */}
              <FormField
                control={form.control}
                name="vendorId"
                render={({ field }) => (
                  <FormItem className={themedFieldClassName}>
                    <FormLabel className={themedLabelClassName}>Vendor</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value ?? ""}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className={themedSelectTriggerClassName}>
                          <SelectValue placeholder="Vendor" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {vendors.map((vendor) => {
                              const fullName = [vendor.firstName, vendor.lastName]
                                .filter(Boolean)
                                .join(" ");

                              return (
                                <SelectItem
                                  key={vendor.id}
                                  value={String(vendor.id)}
                                >
                                  {vendor.companyName || fullName || vendor.vendorCode}
                                </SelectItem>
                              );
                            })}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
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
                    <FormLabel className={themedLabelClassName}>Status</FormLabel>
                    <FormControl>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <SelectTrigger className={themedSelectTriggerClassName}>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {Object.values(POStatus).map((status) => (
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
              
              {/* Remark */}
              <FormField
                control={form.control}
                name="remark"
                render={({ field }) => (
                  <FormItem className="space-y-2.5 md:col-span-2">
                    <FormLabel className={themedLabelClassName}>Remark</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Additional notes"
                        className={themedTextareaClassName}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </TabsContent>

          {/* ================= BILLING TAB ================= */}
          <TabsContent value="billing-cycle" className="mt-6">
            {fields.length > 0 ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-3">
                    {fields.map((field, index) => (
                      <Button
                        key={field.id}
                        type="button"
                        variant={activeCycleIndex === index ? "default" : "outline"}
                        className="min-w-[120px] justify-start px-4"
                        onClick={() => setSelectedCycleIndex(index)}
                      >
                        {formatBillingCycleLabel(
                          watchedBillingCycles[index]?.invoiceDate ??
                            watchedBillingCycles[index]?.billingSubmittedDate,
                        )}
                      </Button>
                    ))}
                  </div>

                  {canManageManualBillingCycles ? (
                    <Button
                      type="button"
                      variant="outline"
                      className="border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                      onClick={openAddBillingCycleDialog}
                    >
                      <Plus className="h-4 w-4" />
                      Add Billing Cycle
                    </Button>
                  ) : null}
                </div>

                {isOTSSelected ? (
                  <p className="text-sm text-slate-500">
                    OTS billing cycles are created from the billing plan and
                    the purchase order dates. You can add another cycle and
                    edit each invoice amount.
                  </p>
                ) : isManualPurchaseOrderType ? (
                  <p className="text-sm text-slate-500">
                    For Mail and Agreement purchase orders, you can add
                    multiple billing cycles and enter each invoice amount
                    manually.
                  </p>
                ) : isFlexibleBillingPlan ? (
                  <p className="text-sm text-slate-500">
                    This billing plan does not create a fixed schedule. Add
                    each billing cycle and enter its invoice amount.
                  </p>
                ) : (
                  <p className="text-sm text-slate-500">
                    Invoice amounts are prefilled from the purchase order. You
                    can edit each invoice amount for any billing plan.
                  </p>
                )}

                <Card className={formCardClassName}>
                  <CardContent className="pt-6">
                    <BillingCycleForm
                      key={
                        fields[activeCycleIndex]?.id ??
                        `${activeCycleIndex}-${watchedBillingCycles[activeCycleIndex]?.invoiceDate}-${watchedBillingCycles[activeCycleIndex]?.billingSubmittedDate}`
                      }
                      field={fields[activeCycleIndex]}
                      index={activeCycleIndex}
                      form={form}
                      canEditInvoiceAmount={canEditInvoiceAmount}
                      canRemoveCycle={
                        canManageManualBillingCycles && fields.length > 1
                      }
                      onRemoveCycle={() =>
                        removeManualBillingCycle(activeCycleIndex)
                      }
                    />
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card className="border border-dashed border-sky-200 bg-gradient-to-b from-white to-sky-50/70 shadow-[0_20px_52px_-34px_rgba(14,165,233,0.32)]">
                <CardContent className="py-10 text-center text-slate-500">
                  <div className="space-y-4">
                    <p>No billing cycles generated yet.</p>
                    {canManageManualBillingCycles ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-sky-200 text-sky-700 hover:bg-sky-50 hover:text-sky-800"
                        onClick={openAddBillingCycleDialog}
                      >
                        <Plus className="h-4 w-4" />
                        Add Billing Cycle
                      </Button>
                    ) : null}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Submit Button */}
        <div className="flex gap-3">
          <Button
            type="submit"
            disabled={isPending}
            className={themedSubmitButtonClassName}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ArrowRight className="w-4 h-4" />
            )}
            {update ? "Update PO" : "Create PO"}
          </Button>
        </div>
      </form>

      <Dialog
        open={isAddCycleDialogOpen}
        onOpenChange={setIsAddCycleDialogOpen}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Billing Cycle</DialogTitle>
            <DialogDescription>
              Choose the month and year for the billing cycle you want to add.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>
                Billing Month
              </FormLabel>
              <FormControl>
                <Select
                  value={pendingCycleMonth}
                  onValueChange={setPendingCycleMonth}
                >
                  <SelectTrigger className={themedSelectTriggerClassName}>
                    <SelectValue placeholder="Select Billing Month" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {MONTH_NAMES.map((monthName, monthIndex) => (
                        <SelectItem
                          value={monthIndex.toString()}
                          key={monthName}
                        >
                          {monthName}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>

            <FormItem className={themedFieldClassName}>
              <FormLabel className={themedLabelClassName}>
                Billing Year
              </FormLabel>
              <FormControl>
                <Select
                  value={pendingCycleYear}
                  onValueChange={setPendingCycleYear}
                >
                  <SelectTrigger className={themedSelectTriggerClassName}>
                    <SelectValue placeholder="Select Billing Year" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {billingCycleYearOptions.map((yearValue) => (
                        <SelectItem value={yearValue} key={yearValue}>
                          {yearValue}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </FormControl>
            </FormItem>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsAddCycleDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={addManualBillingCycle}>
              Add Cycle
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Form>
  );
};

export default POForm;
