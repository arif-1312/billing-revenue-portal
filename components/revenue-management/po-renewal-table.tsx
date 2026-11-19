"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { getUpcomingPoRenewals } from "@/lib/actions/po-renewals";
import { ChartCard } from "./chart-card";

function displayDate(value: string | null) {
  return value ? value.split("-").reverse().join("/") : "—";
}

export function PoRenewalTable() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["upcoming-po-renewals"],
    queryFn: getUpcomingPoRenewals,
    refetchInterval: 5 * 60 * 1000,
  });

  return (
    <ChartCard
      title="PO renewal details"
      description="Live purchase orders ending within 30 days, independent of dashboard filters."
      filename="po-renewal-details.csv"
      rows={(data ?? []).map((order) => ({
        "PO number": order.poNumber, Customer: order.customer, Company: order.company,
        Owner: order.owner, "Start date": displayDate(order.startDate), "End date": displayDate(order.endDate),
        "Days left": order.daysLeft, "PO amount": order.amount ?? "—",
      }))}
      error={isError ? "PO renewals could not be loaded." : null}
    >
        <div className="max-h-80 overflow-auto">
          <table className="w-full min-w-[850px] border-collapse text-left text-xs">
            <thead className="sticky top-0 bg-[#F8FAFC] text-[10px] uppercase tracking-wide text-[#64748B]"><tr>{["PO number", "Customer", "Company", "Owner", "Start date", "End date", "Days left", "PO amount"].map((label) => <th key={label} scope="col" className={`whitespace-nowrap px-3 py-2.5 font-semibold ${label === "PO amount" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
            <tbody className="divide-y divide-[#F1F4F8]">{data?.map((order) => (
              <tr key={order.id} className="text-[#17365D]">
                <td className="px-3 py-2.5 font-medium"><Link className="hover:text-[#1976D2] hover:underline" href={`/admin/revenue/view/${order.id}`}>{order.poNumber}</Link></td>
                <td className="px-3 py-2.5">{order.customer}</td><td className="px-3 py-2.5">{order.company}</td><td className="px-3 py-2.5">{order.owner}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{displayDate(order.startDate)}</td><td className="whitespace-nowrap px-3 py-2.5">{displayDate(order.endDate)}</td>
                <td className="whitespace-nowrap px-3 py-2.5">{order.daysLeft === 0 ? "Ends today" : `${order.daysLeft} days`}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono tabular-nums">{order.amount == null ? "—" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(order.amount)}</td>
              </tr>
            ))}
              {isPending || !data?.length ? (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-[#667085]">{isPending ? "Loading PO renewals..." : "No live purchase orders are ending within 30 days."}</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
    </ChartCard>
  );
}
