"use server";

import { Project } from "@/types";
import { prisma } from "../prisma";
import { projectSchema } from "../validators";
import { formatError } from "../utils";
import { buildFilters, buildMonthlyPLFilters } from "../filter";
import {
  getFinancialYearRange,
  toBusinessDateValue,
} from "../date-utils";
import { requirePermission, type PermissionRule } from "@/lib/rbac";
import { fingerprint } from "@/lib/notifications/model";
import { safePublishSystem } from "@/lib/notifications/publish";

const dashboardView: PermissionRule[] = [
  { route: "/admin/dashboard", action: "view" },
];

const plEdit: PermissionRule[] = [
  { route: "/admin/pl", action: "edit" },
];

async function publishProjectChange(
  eventType: "PL_CREATED" | "PL_UPDATED" | "PL_DELETED",
  project: { id: string; projectName: string; companyId: string },
  fingerprintParts: Array<string | number | null | undefined>,
) {
  const company = await prisma.company.findUnique({
    where: { id: project.companyId },
    select: { name: true },
  })
  const action =
    eventType === "PL_CREATED"
      ? "created"
      : eventType === "PL_UPDATED"
        ? "updated"
        : "deleted"

  await safePublishSystem({
    eventType,
    entityType: "Project",
    entityId: project.id,
    title: `P&L project ${action}`,
    body: `${project.projectName} was ${action}.`,
    href: eventType === "PL_DELETED" ? "/admin/pl" : `/admin/pl/view/${project.id}`,
    companyName: company?.name ?? null,
    fingerprint: fingerprint([eventType, project.id, ...fingerprintParts]),
  })
}

function emptyProjectFilter() {
  return {
    totalPOValue: 0,
    totalBilledValue: 0,
    totalCostValue: 0,
    totalFMSValue: 0,
    totalBillableAmount: 0,
    totalSpareValue: 0,
    totalOtherCostValue: 0,
    totalMiscCostValue: 0,
    totalResourceCount: 0,
    totalProfit: "0",
    totalProjectedProfit: "0",
    data: [],
  };
}

function normalizeProjectPayload(project: Project, amount: {
  totalRevenue: number;
  totalCost: number;
}) {
  const companyId = project.companyId?.trim();
  const projectName = project.projectName?.trim();
  const billingPlanId = project.billingPlanId?.trim();
  const orderType = project.orderType;

  if (!companyId) {
    throw new Error("Company is required");
  }

  if (!projectName) {
    throw new Error("Project name is required");
  }

  if (!billingPlanId) {
    throw new Error("Billing plan is required");
  }

  if (!orderType) {
    throw new Error("Order type is required");
  }

  return {
    companyId,
    projectName,
    startDate: toBusinessDateValue(project.startDate) ?? null,
    endDate: toBusinessDateValue(project.endDate) ?? null,
    poValue: project.poValue ?? 0,
    resourceCount: project.resourceCount ?? 0,
    billingPlanId,
    orderType,
    totalRevenue: amount.totalRevenue,
    totalCost: amount.totalCost,
    projectedProfit: project.projectedProfit ?? 0,
    status: project.status ?? "ACTIVE",
  } as const;
}

export interface PLMonthlyData {
  month: string;
  revenue: number;
  cost: number;
}

export interface PLProjectData {
  projectId: string;
  projectName: string;
  totalRevenue: number;
  totalCost: number;
}

export interface PLData {
  billingCycle: {
    id: string;
    billedAmount: number;
    otherCost: number;
  }[];
  monthly: PLMonthlyData[];
  projects: PLProjectData[];
}

interface MonthlyDetailsParams {
  month: number;
  year: number;
  company?: string;
  project?: string;
  startDate?: any;
  endDate?: any;
}

const monthNames = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export async function getProjects() {
  const access = await requirePermission("/admin/pl", "view", dashboardView);
  if (!access.ok) return [];

  return await prisma.project.findMany({
    orderBy: {
      createdAt: "desc",
    },
    include: {
      company: true,
      billingPlan: true,
    },
  });
}

export async function createProject(data: Project) {
  try {
    const access = await requirePermission("/admin/pl", "create");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const project = projectSchema.parse(data);

    let amount = getTotalAmount(data.billingCycle);
    const payload = normalizeProjectPayload(project, amount);

    let result = await prisma.project.create({
      data: payload,
    });

    createBillingCycle(data.billingCycle, result.id);

    await publishProjectChange("PL_CREATED", {
      id: result.id,
      projectName: payload.projectName,
      companyId: payload.companyId,
    }, [payload.status, String(payload.poValue ?? "")]);

    return {
      success: true,
      message: "Project created successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function getprojectById(id: string) {
  try {
    const access = await requirePermission("/admin/pl", "view", plEdit);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    let project = await prisma.project.findFirst({
      where: { id },
      include: {
        company: true,
      },
    });

    // console.log(project );


    if (project) {
      return {
        success: true,
        data: project,
        message: "Project fetched successfully",
      };
    }

    return {
      success: false,
      message: "Project not found",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function updateProject(data: Project, id: string) {
  try {
    const access = await requirePermission("/admin/pl", "edit");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const project = projectSchema.parse(data);

    let amount = getTotalAmount(data.billingCycle);
    const payload = normalizeProjectPayload(project, amount);

    await prisma.project.update({
      where: { id },
      data: payload,
    });

    createBillingCycle(data.billingCycle, id);

    await publishProjectChange("PL_UPDATED", {
      id,
      projectName: payload.projectName,
      companyId: payload.companyId,
    }, [payload.status, String(payload.poValue ?? ""), String(payload.projectedProfit ?? "")]);

    return {
      success: true,
      message: "Project updated successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function deleteProject(id: any) {
  try {
    const access = await requirePermission("/admin/pl", "delete");
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    const existing = await prisma.project.findUnique({
      where: { id },
      select: { id: true, projectName: true, companyId: true },
    });

    await prisma.project.delete({
      where: { id },
    });

    if (existing) {
      await publishProjectChange("PL_DELETED", existing, [existing.projectName]);
    }

    return {
      success: true,
      message: "Project deleted successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

export async function getBillingCyclesByPOID(id: string) {
  try {
    const access = await requirePermission("/admin/pl", "view", plEdit);
    if (!access.ok) {
      return { success: false, message: access.message };
    }

    let billingCycles = await prisma.projectMonthlyPL.findMany({
      where: {
        projectId: id,
      },
      orderBy: [
        { year: "asc" },
        { month: "asc" },
      ],
    });

    if (billingCycles) {
      return {
        success: true,
        data: billingCycles,
        message: "ProjectMonthlyPL fetched successfully",
      };
    }

    return {
      success: false,
      message: "ProjectMonthlyPL not found",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

async function createBillingCycle(data: any, id: string) {
  try {
    await prisma.projectMonthlyPL.deleteMany({
      where: {
        projectId: id,
      },
    });

    for (const projectMonthlyPL of data) {
      await prisma.projectMonthlyPL.create({
        data: {
          projectId: id,
          month: projectMonthlyPL.month,
          year: projectMonthlyPL.year,
          billedAmount: projectMonthlyPL.billedAmount,
          fms: projectMonthlyPL.fms,
          spare: projectMonthlyPL.spare,
          otherCost: JSON.stringify(projectMonthlyPL.otherCost),
          billableAmount: projectMonthlyPL.billableAmount,
          resourceUsed: projectMonthlyPL.resourceUsed,
        },
      });
    }

    return {
      success: true,
      message: "Billing Cycle created successfully",
    };
  } catch (error) {
    return {
      success: false,
      message: formatError(error),
    };
  }
}

function getTotalAmount(data: any) {
  let amount = {
    totalRevenue: 0,
    totalCost: 0,
  };

  if (data) {
    for (const billingCycle of data) {
      const billed = Number(billingCycle.billedAmount) || 0;
      const fms = Number(billingCycle.fms) || 0;
      const spare = Number(billingCycle.spare) || 0;

      if (billed != 0 && (fms != 0 || spare != 0)) {
        amount.totalRevenue += billed;

        amount.totalCost += fms + spare;

        let otherCostData: any[] = [];

        if (typeof billingCycle.otherCost === "string") {
          try {
            otherCostData = JSON.parse(billingCycle.otherCost);
          } catch (e) {
            console.error("Invalid JSON:", billingCycle.otherCost);
          }
        } else {
          otherCostData = billingCycle.otherCost || [];
        }

        for (const otherCost of otherCostData) {
          if (
            otherCost?.key !== "FMS" &&
            otherCost?.key !== "SPARE" &&
            isFinite(otherCost?.value)
          ) {
            amount.totalCost += Number(otherCost.value);
          }
        }
      }
    }
  }

  return amount;
}

// 🔒 Always returns array (SAFE)
function parseOtherCost(otherCost: any): { key: string; value: number }[] {
  if (!otherCost) return [];

  try {
    if (Array.isArray(otherCost)) return otherCost;

    if (typeof otherCost === "string") {
      const parsed = JSON.parse(otherCost);
      return Array.isArray(parsed) ? parsed : [];
    }

    if (typeof otherCost === "object") {
      return Object.values(otherCost).map((c: any) => ({
        key: c?.key || "",
        value: Number(c?.value || 0),
      }));
    }

    return [];
  } catch (err) {
    console.error("parseOtherCost error:", err);
    return [];
  }
}

// 🔒 Single source of truth for cost calculation
function calculateCost(rec: any): number {
  const parsed = parseOtherCost(rec.otherCost);

  const otherCostTotal = parsed.reduce(
    (sum, c: any) => sum + Number(c?.value || 0),
    0,
  );

  return otherCostTotal + Number(rec.fms || 0) + Number(rec.spare || 0);
}

// ================= MAIN =================

export async function getPLData(year: number, filters?: any): Promise<PLData> {
  const access = await requirePermission("/admin/pl", "view", dashboardView);
  if (!access.ok) {
    return { billingCycle: [], monthly: [], projects: [] };
  }

  const { start, end } = getFinancialYearRange(year);

  const records = await prisma.projectMonthlyPL.findMany({
    where: {
      AND: [
        {
          OR: [
            // Apr–Dec → same year
            {
              year: year,
              month: {
                in: [3, 4, 5, 6, 7, 8, 9, 10, 11], // Apr–Dec
              },
            },
            // Jan–Mar → next year
            {
              year: year + 1,
              month: {
                in: [0, 1, 2], // Jan–Mar
              },
            },
          ],
        },

        ...(filters?.project && filters.project !== "all"
          ? [{ projectId: filters.project }]
          : []),

        ...(filters?.company && filters.company !== "all"
          ? [
            {
              project: {
                is: {
                  companyId: filters.company,
                },
              },
            },
          ]
          : []),
      ],
    },
    include: {
      project: {
        include: {
          company: true,
        },
      },
    },
  });

  // ================= MONTHLY =================
  const monthlyData: PLMonthlyData[] = [
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
  ].map((month, index) => {
    const monthRecords = records.filter((r) => {
      const monthValue = Array.isArray(r.month)
        ? Number(r.month[0])
        : Number(r.month);

      const fyMonth = (monthValue + 9) % 12;

      return fyMonth === index;
    });

    let revenue = 0;
    let cost = 0;

    for (const rec of monthRecords) {
      revenue += Number(rec.billedAmount || 0);
      cost += calculateCost(rec);
    }

    return { month, revenue, cost };
  });

  // ================= PROJECT =================
  const projectMap: Record<string, PLProjectData> = {};

  for (const rec of records) {
    if (!projectMap[rec.projectId]) {
      projectMap[rec.projectId] = {
        projectId: rec.projectId,
        projectName: rec.project.projectName,
        totalRevenue: 0,
        totalCost: 0,
      };
    }

    projectMap[rec.projectId].totalRevenue += Number(rec.billedAmount || 0);
    projectMap[rec.projectId].totalCost += calculateCost(rec);
  }

  const projects = Object.values(projectMap);

  // ================= BILLING CYCLE =================
  const billingCycle = records.map((rec) => ({
    id: rec.id,
    billedAmount: Number(rec.billedAmount || 0),
    otherCost: calculateCost(rec),
  }));

  return {
    monthly: monthlyData,
    projects,
    billingCycle,
  };
}

// ================= STATUS =================
export async function getPLStatusData(year: number, month: number) {
  const data = await getPLData(year);

  // const monthName = monthNames[month - 1];
  const fyMonths = [
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
  ];

  const monthName = fyMonths[month];

  const monthData = data.monthly.find((m) => m.month === monthName);

  const revenue = Number(monthData?.revenue ?? 0);
  const cost = Number(monthData?.cost ?? 0);
  const profit = revenue - cost;
  const overdue = profit < 0 ? Math.abs(profit) : 0;

  return [
    { status: "Revenue", value: revenue },
    { status: "Cost", value: cost },
    { status: "Profit", value: profit > 0 ? profit : 0 },
    { status: "Overdue", value: overdue },
  ];
}

// ================= SUMMARY =================
export async function getPLSummary(year: number) {
  const data = await getPLData(year);

  let totalRevenue = 0;
  let totalCost = 0;

  data.monthly.forEach((m) => {
    totalRevenue += Number(m.revenue || 0);
    totalCost += Number(m.cost || 0);
  });

  return {
    revenue: totalRevenue,
    cost: totalCost,
    profit: totalRevenue - totalCost,
  };
}

// ================= DETAILS =================
export async function getPLStatusDetails(
  status: string,
  year: number,
  month: number, // FY index (0 = Apr, 11 = Mar)
) {
  const access = await requirePermission("/admin/pl", "view", dashboardView);
  if (!access.ok) return [];

  // ✅ Convert FY → DB (calendar)
  const dbMonth = month <= 8 ? month + 3 : month - 9;
  const dbYear = month <= 8 ? year : year + 1;

  const records = await prisma.projectMonthlyPL.findMany({
    where: {
      year: dbYear,
      month: dbMonth,
    },
    include: {
      project: {
        include: {
          company: true,
          billingPlan: true,
        },
      },
    },
  });

  return records
    .map((rec) => {
      const revenue = Number(rec.billedAmount || 0);
      const cost = calculateCost(rec);
      const profit = revenue - cost;

      return {
        id: rec.id,
        poNumber: rec.project?.projectName || "-",
        invoiceNumber: "-",
        companyName: rec.project?.company?.name || "-",
        serviceName: rec.project?.projectName || "-",
        billingPlan: rec.project?.billingPlan?.name || "-",
        amount: profit,
        extraAmount: cost,
      };
    })
    .filter((item) => {
      if (status === "Revenue") return item.amount + item.extraAmount > 0;
      if (status === "Cost") return item.extraAmount > 0;
      if (status === "Profit") return item.amount > 0;
      if (status === "Overdue") return item.amount < 0;
      return true;
    });
}

function safeNumber(value: any) {
  const num = Number(value);
  return isNaN(num) ? 0 : num;
}

export async function fetchPLPageData(projectId: string) {
  const access = await requirePermission("/admin/pl", "view");
  if (!access.ok) {
    return { success: false, message: access.message };
  }

  const projectRes = await getprojectById(projectId);
  const billingRes = await getBillingCyclesByPOID(projectId);

  if (!projectRes.success || !projectRes.data) {
    return { success: false, message: "Project not found" };
  }

  const project: any = projectRes.data;
  const billingCycles =
    billingRes.success && billingRes.data ? billingRes.data : [];

  // Map billing cycles with safe numbers and calculate profit
  const billingCyclesSafe = billingCycles.map((b: any) => {
    const billedAmount = safeNumber(b.billedAmount);
    const fms = safeNumber(b.fms);
    const spare = safeNumber(b.spare);
    const billableAmount = safeNumber(b.billableAmount);
    const resourceUsed = safeNumber(b.resourceUsed);

    // Parse otherCost safely
    let otherCost = 0;
    if (b.otherCost) {
      try {
        let parsed = Array.isArray(b.otherCost)
          ? b.otherCost
          : typeof b.otherCost === "string"
            ? JSON.parse(b.otherCost)
            : [];

        if (!Array.isArray(parsed)) parsed = [];

        otherCost = parsed.reduce(
          (sum: number, c: any) => sum + safeNumber(c.value),
          0,
        );
      } catch (err) {
        otherCost = 0;
      }
    }

    const totalCost = fms + spare + otherCost;
    const profitAmount = billedAmount - totalCost;
    const profitPercent =
      billedAmount === 0 ? 0 : (profitAmount / billedAmount) * 100;

    return {
      id: b.id,
      month: b.month,
      year: b.year,
      billedAmount,
      billableAmount,
      resourceUsed,
      fms,
      spare,
      otherCost,
      totalCost,
      profitAmount,
      profitPercent,
    };
  });

  // ================== TOTALS ==================
  const totalBilledValue = billingCyclesSafe.reduce(
    (sum, b) => sum + b.billedAmount,
    0,
  );
  const totalCostValue = billingCyclesSafe.reduce(
    (sum, b) => sum + b.totalCost,
    0,
  );
  const totalFMSValue = billingCyclesSafe.reduce((sum, b) => sum + b.fms, 0);
  const totalSpareValue = billingCyclesSafe.reduce(
    (sum, b) => sum + b.spare,
    0,
  );
  const totalResourceCount = safeNumber(project.resourceCount);
  const totalPOValue = safeNumber(project.poValue);
  const totalProfit =
    totalBilledValue === 0
      ? 0
      : ((totalBilledValue - totalCostValue) / totalBilledValue) * 100;
  const totalBillableAmount = billingCyclesSafe.reduce(
    (sum, b) => sum + b.billableAmount,
    0,
  );
  const totalResourceUsed = billingCyclesSafe.reduce(
    (sum, b) => sum + b.resourceUsed,
    0,
  );
  const totalProjectedProfit = safeNumber(project.projectedProfit);

  return {
    success: true,
    project,
    billingCycles: billingCyclesSafe,
    totals: {
      totalPOValue,
      totalBilledValue,
      totalBillableAmount,
      totalResourceUsed,
      totalCostValue,
      totalResourceCount,
      totalFMSValue,
      totalSpareValue,
      totalProfit,
      totalProjectedProfit,
    },
  };
}

export async function filterProjectData(filters: any) {
  const access = await requirePermission("/admin/pl", "view", dashboardView);
  if (!access.ok) return emptyProjectFilter();

  const where = buildFilters(filters);
  const monthlyPLWhere = buildMonthlyPLFilters(filters);
  const hasFinancialPeriodFilter =
    (filters?.year && filters.year !== "all") ||
    (filters?.month && filters.month !== "all");

  let totalPOValue = 0;
  let totalBilledValue = 0;
  let totalCostValue = 0;
  let totalBillableAmount = 0;
  let totalFMSValue = 0;
  let totalSpareValue = 0;
  let totalOtherCostValue = 0;
  let totalMiscCostValue = 0;
  let totalResourceCount = 0;
  let totalProfitPercentage = 0;
  let totalProjectedProfit = 0;


  const projects = await prisma.project.findMany({
    where,
    include: {
      company: true,
      monthlyPLs: {
        where: monthlyPLWhere,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const totalBillableByProject = hasFinancialPeriodFilter &&
    projects.length > 0
    ? await prisma.projectMonthlyPL.groupBy({
      by: ["projectId"],
      where: {
        projectId: {
          in: projects.map((project) => project.id),
        },
      },
      _sum: {
        billableAmount: true,
      },
    })
    : [];

  const totalBillableByProjectMap = new Map(
    totalBillableByProject.map((item) => [
      item.projectId,
      Number(item._sum.billableAmount || 0),
    ]),
  );

  if (projects.length > 0) {
    for (const project of projects) {
      const res = getDetailsByProject(project);
      const projectPOValue = Number(project.poValue || 0);
      const filteredBillableAmount = (project.monthlyPLs || []).reduce(
        (sum, cycle) => sum + Number(cycle.billableAmount || 0),
        0,
      );
      const totalProjectBillableAmount =
        totalBillableByProjectMap.get(project.id) ??
        filteredBillableAmount;
      const adjustedPOValue =
        hasFinancialPeriodFilter &&
        totalProjectBillableAmount > 0
          ? projectPOValue *
            Math.min(
              filteredBillableAmount /
                totalProjectBillableAmount,
              1,
            )
          : projectPOValue;

      totalPOValue += adjustedPOValue;
      totalBilledValue += res.totalBilledValue;
      totalCostValue += res.totalCostValue;
      totalFMSValue += res.totalFmsValue;
      totalSpareValue += res.totalSpareValue;
      totalOtherCostValue += res.totalOtherCost;
      totalMiscCostValue += res.totalMiscellaneousCost;
      totalResourceCount += Number(project.resourceCount || 0);
      totalProfitPercentage += Number(res.profit || 0);
      totalProjectedProfit += Number(project.projectedProfit || 0);

      for (const cycle of project.monthlyPLs || []) {
        totalBillableAmount += Number(cycle.billableAmount || 0);
      }
    }
  }

  return {
    totalPOValue,
    totalBilledValue,
    totalCostValue,
    totalFMSValue,
    totalBillableAmount,
    totalSpareValue,
    totalOtherCostValue,
    totalMiscCostValue,
    totalResourceCount,
    totalProfit: (totalProfitPercentage / (projects.length || 1)).toFixed(2),
    totalProjectedProfit:
      projects.length > 0 ? (totalProjectedProfit / projects.length).toFixed(2) : "0",
    data: JSON.parse(JSON.stringify(projects)),
  };
}

export async function getMonthlyRevenueCost(year: number, filters: any) {
  const data = await getPLData(year, filters);

  return {
    revenue: data.monthly.map((m) => ({
      month: m.month,
      value: Number(m.revenue || 0),
    })),
    cost: data.monthly.map((m) => ({
      month: m.month,
      value: Number(m.cost || 0),
    })),
  };
}

export async function getBillingDetailsByMonth(
  params: MonthlyDetailsParams,
  filters: any,
) {
  const access = await requirePermission("/admin/pl", "view", dashboardView);
  if (!access.ok) return [];

  const { month, year, company, project } = params;

  // ✅ FY → DB conversion
  const dbMonth = month <= 8 ? month + 3 : month - 9;
  const dbYear = month <= 8 ? year : year + 1;

  const data = await prisma.projectMonthlyPL.findMany({
    where: {
      month: dbMonth,
      year: dbYear,

      ...(project &&
        project !== "all" && {
        projectId: project,
      }),

      ...(company &&
        company !== "all" && {
        project: {
          is: {
            companyId: company,
          },
        },
      }),

      ...(filters?.startDate || filters?.endDate
        ? {
          project: {
            is: {
              ...(filters.company &&
                filters.company !== "all" && {
                companyId: filters.company,
              }),

              ...(filters.startDate && {
                startDate: {
                  gte: new Date(filters.startDate),
                },
              }),

              ...(filters.endDate && {
                endDate: {
                  lte: new Date(filters.endDate),
                },
              }),
            },
          },
        }
        : {}),
    },
    include: {
      project: {
        include: {
          company: true,
        },
      },
    },
  });

  return data.map((item) => ({
    month,
    year,
    companyName: item.project.company.name,
    projectName: item.project.projectName,
    billed: Number(item.billedAmount || 0),
  }));
}

// ✅ Cost Details
export async function getCostDetailsByMonth(
  params: MonthlyDetailsParams,
  filters: any,
) {
  const access = await requirePermission("/admin/pl", "view", dashboardView);
  if (!access.ok) return [];

  const { month, year, company, project } = params;

  // ✅ FY → DB conversion
  const dbMonth = month <= 8 ? month + 3 : month - 9;
  const dbYear = month <= 8 ? year : year + 1;

  const data = await prisma.projectMonthlyPL.findMany({
    where: {
      month: dbMonth,
      year: dbYear,

      ...(project &&
        project !== "all" && {
        projectId: project,
      }),

      ...(company &&
        company !== "all" && {
        project: {
          is: {
            companyId: company,
          },
        },
      }),

      ...(filters?.startDate || filters?.endDate
        ? {
          project: {
            is: {
              ...(filters.company &&
                filters.company !== "all" && {
                companyId: filters.company,
              }),

              ...(filters.startDate && {
                startDate: {
                  gte: new Date(filters.startDate),
                },
              }),

              ...(filters.endDate && {
                endDate: {
                  lte: new Date(filters.endDate),
                },
              }),
            },
          },
        }
        : {}),
    },
    include: {
      project: {
        include: {
          company: true,
        },
      },
    },
  });

  return data.map((item) => ({
    month,
    year,
    companyName: item.project.company.name,
    projectName: item.project.projectName,
    billedAmount: Number(item.billedAmount || 0),
    fms: Number(item.fms || 0),
    spare: Number(item.spare || 0),
    other: parseOtherCost(item.otherCost),
  }));
}

function getDetailsByProject(project: any) {
  let totalBilledValue = 0;
  let totalCostValue = 0;
  let totalFmsValue = 0;
  let totalSpareValue = 0;
  let totalOtherCost = 0;
  let totalMiscellaneousCost = 0;

  for (const cycle of project.monthlyPLs || []) {
    const billed = Number(cycle.billedAmount || 0);
    const fms = Number(cycle.fms || 0);
    const spare = Number(cycle.spare || 0);

    totalBilledValue += billed;
    totalFmsValue += fms;
    totalSpareValue += spare;
    totalCostValue += fms + spare;

    const otherCosts = parseOtherCost(cycle.otherCost);

    for (const bill of otherCosts) {
      const value = Number(bill.value || 0);

      totalOtherCost += value;
      totalMiscellaneousCost += value;
      totalCostValue += value;
    }
  }

  let profit =
    totalBilledValue > 0
      ? (
        ((totalBilledValue - totalCostValue) / totalBilledValue) *
        100
      ).toFixed(2)
      : "0";

  return {
    totalBilledValue,
    totalCostValue,
    totalFmsValue,
    totalSpareValue,
    totalOtherCost,
    totalMiscellaneousCost,
    profit,
  };
}
