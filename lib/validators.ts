import { z } from "zod";
import {
  Status,
  PaymentReceived,
  POStatus,
  OrderType,
  CompanyStatus,
  PurchaseOrderType,
} from "@prisma/client";

/* ---------------- ENUMS ---------------- */
export const statusEnum = z.nativeEnum(Status).optional();
export const paymentReceivedEnum = z.nativeEnum(PaymentReceived).optional();
export const poStatusEnum = z.nativeEnum(POStatus).optional();
export const purchaseOrderTypeEnum = z.preprocess((val) => {
  if (val == null) return undefined;
  if (typeof val !== "string") return val;

  const normalized = val.trim().toUpperCase();
  return normalized === "" ? undefined : normalized;
}, z.nativeEnum(PurchaseOrderType).optional());

export const MONEY_MAX = 9999999999.99
const moneyMessage = "Amount must be between 0 and 9999999999.99"

export function isAllowedMoneyAmount(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= MONEY_MAX
}

const finiteMoney = z
  .number()
  .min(0, moneyMessage)
  .max(MONEY_MAX, moneyMessage)
  .refine((value) => Number.isFinite(value), { message: moneyMessage })

function moneyInput(value: unknown) {
  if (value === "" || value === null || value === undefined) return undefined
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    if (!trimmed) return undefined
    return Number(trimmed)
  }
  return Number(value)
}

export const optionalMoneySchema = z.preprocess(moneyInput, finiteMoney.optional())

export const moneyWithDefaultSchema = z.preprocess(
  (value) =>
    value === "" || value === undefined || value === null ? 0 : Number(value),
  finiteMoney,
)

/* ---------------- AUTH ---------------- */
export const loginFormSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

/* ---------------- ROLE ---------------- */
export const roleSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  remark: z.string().nullable().optional(),
  status: z.nativeEnum(Status).optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

/* ---------------- MODULE ---------------- */
export const moduleSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  description: z.string().optional(),
  route: z.string().optional(),
  status: z.enum(Object.values(Status)).optional(),
  createdAt: z.string().nullable().optional(),
  updatedAt: z.string().nullable().optional(),
});

/* ---------------- USER ---------------- */
export const userSchema = z.object({
  id: z.string().optional(),
  password: z.string().optional(),
  username: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  status: z.nativeEnum(Status).optional(),
  roleId: z.string().optional(),
  remark: z.string().nullable().optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

export const createUserSchema = userSchema.extend({
  password: z.string().optional(),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().trim().min(1, "Current password is required"),
    newPassword: z
      .string()
      .trim()
      .min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().trim().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password must match",
    path: ["confirmPassword"],
  });

export const updateCurrentUserProfileSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().optional(),
});

/* ---------------- BILLING CYCLE ---------------- */
export const billingCycleSchema = z.object({
  id: z.string().optional(),
  purchaseOrderId: z.string().optional(),

  billingSubmittedDate: z.union([z.date(), z.string()]).nullable().optional(),

  paymentReceived: z.nativeEnum(PaymentReceived).optional(),

  paymentReceivedDate: z.union([z.date(), z.string()]).nullable().optional(),

  payments: z
    .array(
      z.object({
        id: z.string().optional(),
        receivedDate: z.union([z.date(), z.string()]).nullable().optional(),
        amount: moneyWithDefaultSchema,
      }),
    )
    .optional()
    .default([]),

  paymentDueDate: z.union([z.date(), z.string()]).nullable().optional(),

  billingRemark: z.string().optional(),

  collectedAmount: optionalMoneySchema,

  invoiceAmount: optionalMoneySchema,

  invoiceDate: z.union([z.date(), z.string()]).nullable().optional(),

  invoiceNumber: z.string().optional(),

  tds: optionalMoneySchema,

  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

const optionalTrimmedString = z.preprocess((val) => {
  if (typeof val !== "string") return val;

  const trimmed = val.trim();
  return trimmed === "" ? undefined : trimmed;
}, z.string().optional());

/* ---------------- PURCHASE ORDER ---------------- */
export const purchaseOrderSchema = z.object({
  id: z.string().optional(),

  customerPONumber: optionalTrimmedString,

  poAmount: optionalMoneySchema,

  serviceTypeId: optionalTrimmedString,

  contractDurationId: optionalTrimmedString,

  contractId: optionalTrimmedString,

  companyId: optionalTrimmedString,

  vendorId: optionalTrimmedString,

  startFrom: z.union([z.date(), z.string()]).nullable().optional(),

  endDate: z.union([z.date(), z.string()]).nullable().optional(),

  paymentTerms: optionalTrimmedString,

  billingPlanId: optionalTrimmedString,

  customerId: optionalTrimmedString,

  poOwner: optionalTrimmedString,

  billingCycles: z.array(billingCycleSchema).optional().default([]),

  purchaseOrderType: purchaseOrderTypeEnum,

  status: z.nativeEnum(POStatus).optional(),

  remark: z.string().optional(),

  ageingDays: z.number().optional(),

  scope: z.preprocess(
    (val) => (typeof val === "string" ? val.trim() : val),
    z.string().optional().default(""),
  ),

  createdAt: z.date().nullable().optional(),

  updatedAt: z.date().nullable().optional(),
});

/* ---------------- SERVICE TYPE ---------------- */
export const serviceTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  remark: z.string().nullable().optional(),
  status: z.nativeEnum(Status).optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

/* ---------------- CONTRACT TYPE ---------------- */
export const contractTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  remark: z.string().nullable().optional(),
  status: z.nativeEnum(Status).optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().nullable().optional(),
});

/* ---------------- BILLING PLAN ---------------- */
export const billingPlanSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  totalBillingCycles: z.number().optional(),
  status: z.nativeEnum(Status).optional(),
  remark: z.string().nullable().optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().optional(),
  billingCycleType: z.enum(["START", "MID", "END"]).optional(),
});

/* ---------------- CONTRACT DURATION ---------------- */
export const contractDurationSchema = z.object({
  id: z.string().optional(),
  name: z.string().optional(),
  totalNumberOfMonths: z.number().optional(),
  status: z.nativeEnum(Status).optional(),
  remark: z.string().nullable().optional(),
  createdAt: z.date().nullable().optional(),
  updatedAt: z.date().optional(),
});

/* ---------------- CUSTOMER ---------------- */
export const customerSchema = z.object({
  id: z.string().optional(),

  customerCode: z.string().optional(),

  firstName: z.string().optional(),

  lastName: z.string().optional(),

  phone: z.string().optional(),

  companyName: z.string().optional(),

  alternatePhone: z.string().optional(),

  email: z.string().optional(),

  addressLine1: z.string().optional(),

  addressLine2: z.string().optional(),

  city: z.string().optional(),

  state: z.string().optional(),

  country: z.string().optional(),

  postalCode: z.string().optional(),

  gstNumber: z.string().optional(),

  panNumber: z.string().optional(),

  website: z.string().optional(),

  remark: z.string().nullable().optional(),

  status: z.nativeEnum(Status).optional(),

  createdAt: z.date().nullable().optional(),

  updatedAt: z.date().optional(),
});

/* ---------------- VENDOR ---------------- */
export const vendorSchema = z.object({
  id: z.string().optional(),

  vendorCode: z.string().optional(),

  firstName: z.string().optional(),

  lastName: z.string().optional(),

  phone: z.string().optional(),

  companyName: z.string().optional(),

  alternatePhone: z.string().optional(),

  email: z.string().optional(),

  addressLine1: z.string().optional(),

  addressLine2: z.string().optional(),

  city: z.string().optional(),

  state: z.string().optional(),

  country: z.string().optional(),

  postalCode: z.string().optional(),

  gstNumber: z.string().optional(),

  panNumber: z.string().optional(),

  website: z.string().optional(),

  remark: z.string().nullable().optional(),

  status: z.nativeEnum(Status).optional(),

  createdAt: z.union([z.date(), z.string()]).nullable().optional(),

  updatedAt: z.union([z.date(), z.string()]).nullable().optional(),
});

/* ---------------- COMPANY ---------------- */
export const companySchema = z.object({
  id: z.string().optional(),

  name: z.string().optional(),

  companyCode: z.string().optional(),

  email: z.string().optional(),

  phone: z.string().optional(),

  alternatePhone: z.string().optional(),

  addressLine1: z.string().optional(),

  addressLine2: z.string().optional(),

  city: z.string().optional(),

  state: z.string().optional(),

  country: z.string().optional(),

  pincode: z.string().optional(),

  gstNumber: z.string().optional(),

  panNumber: z.string().optional(),

  cinNumber: z.string().optional(),

  status: z.enum(Object.values(CompanyStatus)).optional(),

  createdAt: z.date().nullable().optional(),

  updatedAt: z.date().optional(),
});

/* ---------------- PROJECT MONTHLY PL ---------------- */
export const projectMonthlyPLSchema = z.object({
  id: z.string().optional(),

  projectId: z.string().optional(),

  month: z.coerce.number().optional(),

  year: z.coerce.number().optional(),

  billedAmount: optionalMoneySchema,

  fms: optionalMoneySchema,

  spare: optionalMoneySchema,

  billableAmount: optionalMoneySchema,

  resourceUsed: optionalMoneySchema,

  otherCost: z.any().optional(),

  createdAt: z.date().nullable().optional(),

  updatedAt: z.date().optional(),
});

/* ---------------- PROJECT ---------------- */
export const projectSchema = z.object({
  id: z.string().optional(),

  companyId: z.string().optional(),

  projectName: z.string().optional(),

  startDate: z.union([z.date(), z.string()]).nullable().optional(),

  endDate: z.union([z.date(), z.string()]).nullable().optional(),

  poValue: optionalMoneySchema,

  resourceCount: z.coerce.number().optional(),

  billingPlanId: z.string().optional(),

  orderType: z.enum(Object.values(OrderType)).optional(),

  projectedProfit: optionalMoneySchema,

  status: z.enum(Object.values(Status)).optional(),

  billingCycle: z.array(projectMonthlyPLSchema).optional().default([]),

  createdAt: z.date().nullable().optional(),

  updatedAt: z.date().optional(),
});

/* ---------------- CONFIGURATION ---------------- */
export const configurationSchema = z.object({
  id: z.string().optional(),

  name: z.string().optional(),

  logo: z.union([z.instanceof(File), z.string()]).optional(),

  favicon: z.union([z.instanceof(File), z.string()]).optional(),

  email: z.string().optional(),

  password: z.string().optional(),
});
