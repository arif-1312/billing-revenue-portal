import {
  OrderType,
  PaymentReceived,
  POStatus,
  Status,
  CompanyStatus,
  BillingCycleType,
} from "@prisma/client";
import { toBusinessDateValue } from "../date-utils";

export const APP_NAME =
  process.env.NEXT_APP_APP_NAME ?? "Billing & Revenue Portal";

export const APP_DESCRIPTION =
  process.env.NEXT_APP_DESCRIPTION ??
  "Internal Billing & Revenue Management System";

export const SERVER_URL =
  process.env.NEXT_APP_SERVER_URL ?? "http://localhost:3000";

/* ---------------- COMMON ---------------- */
export const formatDate = (date?: Date | null) =>
  toBusinessDateValue(date)?.toISOString().split("T")[0] ?? "";

/* ---------------- ROLE ---------------- */
export const roleDefaultValues = {
  name: "",
  remark: "",
  status: Status.ACTIVE,
};

/* ---------------- USER ---------------- */
export const userDefaultValues = {
  username: "",
  password: "",
  firstName: "",
  lastName: "",
  email: "",
  status: Status.ACTIVE,
  remark: "",
  roleId: "",
};

/* ---------------- MODULE ---------------- */
export const moduleDefaultValues = {
  name: "",
  description: "",
  route: "",
  status: Status.ACTIVE,
};

/* ---------------- PURCHASE ORDER ---------------- */
export const purchaseOrderDefaultValues = {
  customerPONumber: "",
  poAmount: 0,

  serviceTypeId: "",
  contractDurationId: "",
  contractId: "",
  companyId: "",
  vendorId: "",

  startFrom: null as Date | null,
  endDate: null as Date | null,

  paymentTerms: "",
  billingPlanId: "",
  customerId: "",
  poOwner: "",

  status: POStatus.LIVE,
  remark: "",

  ageingDays: "",
  scope: "",

  billingCycles: [
    {
      invoiceNumber: "",
      invoiceAmount: 0,
      creditNote: 0,
      collectedAmount: 0,
      invoiceDate: null as Date | null,
      billingSubmittedDate: null as Date | null,
      paymentReceived: PaymentReceived.NO,
      paymentReceivedDate: null as Date | null,
      payments: [] as Array<{ receivedDate: Date | null; amount: number }>,
      paymentDueDate: null as Date | null,
      billingRemark: "",
      tds: 0,
    },
  ],
};

/* ---------------- SERVICE TYPE ---------------- */
export const serviceTypeDefaultValues = {
  name: "",
  remark: "",
  status: Status.ACTIVE,
};

/* ---------------- BILLING PLAN ---------------- */
export const billingPlanDefaultValues = {
  name: "",
  totalBillingCycles: 0,
  billingCycleType: BillingCycleType.START,
  remark: "",
  status: Status.ACTIVE,
};

/* ---------------- CONTRACT DURATION ---------------- */
export const contractDurationDefaultValues = {
  name: "",
  totalNumberOfMonths: 0,
  remark: "",
  status: Status.ACTIVE,
};

/* ---------------- CONTRACT TYPE ---------------- */
export const contractTypeDefaultValues = {
  name: "",
  remark: "",
  status: Status.ACTIVE,
};

/* ---------------- CUSTOMER ---------------- */
export const customerDefaultValues = {
  customerCode: "",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  alternatePhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  gstNumber: "",
  panNumber: "",
  website: "",
  remark: "",
  status: Status.ACTIVE,
};

/* ---------------- VENDOR ---------------- */
export const vendorDefaultValues = {
  vendorCode: "",
  firstName: "",
  lastName: "",
  companyName: "",
  email: "",
  phone: "",
  alternatePhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  postalCode: "",
  gstNumber: "",
  panNumber: "",
  website: "",
  remark: "",
  status: Status.ACTIVE,
};

/* ---------------- PROJECT MONTHLY PL ---------------- */
export const projectMonthlyPLDefaultValues = {
  month: new Date().getMonth() + 1,
  year: new Date().getFullYear(),
  billedAmount: 0,
  fms: 0,
  spare: 0,
  otherCost: {},
  billableAmount: 0,
  resourceUsed: 0,
};

/* ---------------- PROJECT ---------------- */
export const plDefaultValues = {
  companyId: "",
  projectName: "",
  startDate: new Date(),
  endDate: null as Date | null,
  poValue: 0,
  orderType: OrderType.OTHER,
  resourceCount: 0,
  billingPlanId: "",
  totalRevenue: 0,
  totalCost: 0,
  projectedProfit: 0,
  status: Status.ACTIVE,
  monthlyPLs: [projectMonthlyPLDefaultValues],
};

/* ---------------- COMPANY ---------------- */
export const companyDefaultValues = {
  name: "",
  companyCode: "",
  email: "",
  phone: "",
  alternatePhone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  state: "",
  country: "",
  pincode: "",
  gstNumber: "",
  panNumber: "",
  cinNumber: "",
  status: CompanyStatus.ACTIVE,
};
