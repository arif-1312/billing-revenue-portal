"use client";

import { useEffect, useState } from "react";
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Cell,
  Tooltip,
  Legend,
} from "recharts";

import {
  getPLStatusData,
  getPLStatusDetails,
} from "@/lib/actions/project";
import { Card, CardContent } from "../ui/card";

// ================= TYPES =================
interface PLDetail {
  status: string;
  value: number;
  fill?: string;
}

interface POItem {
  id: string;
  poNumber: string;
  companyName?: string;
  serviceName?: string;
  billingPlan?: string;
  amount: number; // profit
  extraAmount?: number;
}

const colors: Record<string, string> = {
  Revenue: "#1976D2",
  Cost: "#E69A23",
  Profit: "#15966A",
  Overdue: "#DC4545",
};

// ================= COMPONENT =================
export function PLStatusChart() {
  const currentYear = new Date().getFullYear();

  const [year, setYear] = useState(currentYear.toString());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  const [chartData, setChartData] = useState<PLDetail[]>([]);
  const [selectedSlice, setSelectedSlice] =
    useState<PLDetail | null>(null);
  const [sliceDetails, setSliceDetails] = useState<POItem[]>([]);

  // ================= FETCH =================
  useEffect(() => {
    const fetchData = async () => {
      const data = await getPLStatusData(Number(year), month);

      const finalData = data.map((detail) => ({
        ...detail,
        fill: colors[detail.status],
      }));

      setChartData(finalData);
      setSelectedSlice(null);
      setSliceDetails([]);
    };

    fetchData();
  }, [year, month]);

  // ================= CLICK =================
  const handleSliceClick = async (data: PLDetail) => {
    if (data.value === 0) return;

    setSelectedSlice(data);

    const details = await getPLStatusDetails(
      data.status,
      Number(year),
      month
    );

    setSliceDetails(details || []);
  };

  const totalValue = chartData.reduce((sum, d) => sum + d.value, 0);

  return (
    <div className="flex flex-col md:flex-row gap-4">

      {/* LEFT */}
      <div className="w-full md:w-1/3">
        <Card>
          <CardContent>
            {/* Filters */}
            <div className="flex gap-2 mb-2">
              <select
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="border px-2 py-1 rounded"
              >
                <option value={currentYear - 2}>{currentYear - 2}</option>
                <option value={currentYear - 1}>{currentYear - 1}</option>
                <option value={currentYear}>{currentYear}</option>
              </select>

              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="border px-2 py-1 rounded"
              >
                {[
                  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
                ].map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>

            {/* Pie */}
            {totalValue > 0 ? (
              <div style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Tooltip formatter={(v: number) => [`₹${v}`]} />
                    <Legend />

                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="status"
                      innerRadius={50}
                      outerRadius={80}
                      onClick={handleSliceClick}
                      label={({ value }) => `₹${value.toLocaleString()}`}
                    >
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Pie>

                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[260px] flex items-center justify-center border rounded text-gray-500">
                No data found
              </div>
            )}
          </CardContent>
        </Card>

      </div>

      {/* RIGHT */}
      <div className="w-full md:w-2/3 overflow-auto max-h-[360px]">

        {totalValue === 0 ? (
          <div className="border p-4 text-gray-500">
            No data found
          </div>
        ) : selectedSlice ? (
          <div className="border p-4 rounded shadow">
            <h3 className="font-semibold mb-2">
              {selectedSlice.status}
            </h3>

            <table className="w-full text-sm border">
              <thead>
                <tr>
                  <th className="border px-2 py-1">PO Number</th>
                  <th className="border px-2 py-1">Company Name</th>
                  <th className="border px-2 py-1">Service Type</th>
                  <th className="border px-2 py-1">Billing Plan</th>
                  <th className="border px-2 py-1">Profit</th>
                  <th className="border px-2 py-1">Cost</th>
                </tr>
              </thead>

              <tbody>
                {sliceDetails.length > 0 ? (
                  sliceDetails.map((item) => (
                    <tr key={item.id}>
                      <td className="border px-2">{item.poNumber}</td>
                      <td className="border px-2">{item.companyName || "-"}</td>
                      <td className="border px-2">{item.serviceName}</td>
                      <td className="border px-2">{item.billingPlan}</td>
                      <td className="border px-2">
                        ₹{item.amount.toLocaleString("en-IN")}
                      </td>
                      <td className="border px-2">
                        ₹{(item.extraAmount || 0).toLocaleString("en-IN")}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="text-center py-3 text-gray-500">
                      No details found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="border p-4 text-gray-500">
            Click chart to view details
          </div>
        )}
      </div>
    </div>
  );
}
