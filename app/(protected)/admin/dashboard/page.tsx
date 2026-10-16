import { Suspense } from "react";
import { redirect } from "next/navigation";

import { getProjects } from "@/lib/actions/project";
import { getCompanys } from "@/lib/actions/company";
import { getCustomers } from "@/lib/actions/customer";
import { canonicalCustomerName } from "@/lib/customer-names";
import { canonicalCompanyName } from "@/lib/company-names";
import { PLDashboardComponent } from "@/components/pl/pl-dashboard-component";
import { RevenueDashboard } from "@/components/revenue-dashboard/revenue-dashboard";
import { getFiscalYear } from "@/lib/fiscal-year";
import { canAccess } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: PageProps<"/admin/dashboard">) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const canView = await canAccess("/admin/dashboard", "view");

  if (!canView) {
    redirect("/404");
  }

  const activeTab = Array.isArray(resolvedSearchParams.tab)
    ? resolvedSearchParams.tab[0]
    : resolvedSearchParams.tab;
  const projects = await getProjects();
  const companies = await getCompanys();
  const customers = await getCustomers();
  const customerOptions = customers
    .map((customer) => {
      const fullName = [customer.firstName, customer.lastName]
        .filter(Boolean)
        .join(" ")
        .trim();

      return {
        id: customer.id,
        name: canonicalCustomerName(
          customer.companyName?.trim() ||
            fullName ||
            customer.customerCode ||
            "",
        ),
      };
    })
    .filter((customer) => customer.name)
    .sort((left, right) => left.name.localeCompare(right.name));

  const currentTab =
    activeTab === "revenue" ? "revenue" : "pl";

  if (currentTab === "revenue") {
    return (
      <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-slate-100" />}>
        <RevenueDashboard
          defaultYear={getFiscalYear(new Date())}
          companies={companies
            .map((company) => ({
              id: company.id,
              name: canonicalCompanyName(company.name),
            }))
            .sort((left, right) => left.name.localeCompare(right.name))}
          customers={JSON.parse(JSON.stringify(customerOptions))}
        />
      </Suspense>
    );
  }

  return (
    <PLDashboardComponent
      companies={JSON.parse(JSON.stringify(companies))}
      projects={JSON.parse(JSON.stringify(projects))}
    />
  );
}
