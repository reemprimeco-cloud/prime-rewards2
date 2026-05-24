import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Loader2, Gift, TrendingUp, Award, Users, Star, BarChart2 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const TIER_COLORS = {
  Bronze: "#CD7F32",
  Silver: "#94A3B8",
  Gold: "#F59E0B",
  Platinum: "#6366F1",
};

const REWARD_TYPE_COLORS = ["#1B2A5E", "#5B9BD5", "#10B981", "#F59E0B", "#6366F1", "#EC4899"];

export default function AdminAnalytics() {
  const { language } = useLanguage();
  const { data: analytics, isLoading } = trpc.admin.analytics.useQuery();

  const tierData = analytics?.tierCounts?.map((t: any) => ({
    name: t.tier,
    value: t.count,
    color: TIER_COLORS[t.tier as keyof typeof TIER_COLORS] ?? "#5B9BD5",
  })) ?? [];

  const kpis = [
    {
      label: language === "ar" ? "إجمالي العملاء" : "Total Customers",
      value: analytics?.totalCustomers ?? 0,
      icon: Users,
      color: "#1B2A5E",
      bg: "bg-blue-50",
    },
    {
      label: language === "ar" ? "نشطون (30 يوم)" : "Active (30 days)",
      value: analytics?.activeCustomers ?? 0,
      icon: TrendingUp,
      color: "#10B981",
      bg: "bg-green-50",
    },
    {
      label: language === "ar" ? "فواتير معتمدة" : "Approved Invoices",
      value: analytics?.approvedInvoices ?? 0,
      icon: BarChart2,
      color: "#5B9BD5",
      bg: "bg-sky-50",
    },
    {
      label: language === "ar" ? "إجمالي الاستبدالات" : "Total Redemptions",
      value: analytics?.totalRedemptions ?? 0,
      icon: Gift,
      color: "#6366F1",
      bg: "bg-indigo-50",
    },
    {
      label: language === "ar" ? "فواتير معلقة" : "Pending Invoices",
      value: analytics?.pendingInvoices ?? 0,
      icon: Award,
      color: "#F59E0B",
      bg: "bg-yellow-50",
    },
    {
      label: language === "ar" ? "بلاغات احتيال مفتوحة" : "Open Fraud Flags",
      value: analytics?.openFraudFlags ?? 0,
      icon: Star,
      color: "#EF4444",
      bg: "bg-red-50",
    },
  ];

  // Derived: points per tier estimate (lifetime points / customer count)
  const tierBarData = tierData.map((t: any) => ({
    name: t.name,
    customers: t.value,
  }));

  // Engagement rate
  const engagementRate = analytics?.totalCustomers
    ? Math.round((analytics.activeCustomers / analytics.totalCustomers) * 100)
    : 0;

  // Invoice approval rate
  const totalProcessed = (analytics?.approvedInvoices ?? 0) + (analytics?.pendingInvoices ?? 0);
  const approvalRate = totalProcessed > 0
    ? Math.round((analytics!.approvedInvoices / totalProcessed) * 100)
    : 0;

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[#1B2A5E]">
            {language === "ar" ? "تحليلات المكافآت" : "Reward Analytics"}
          </h2>
          <p className="text-sm text-gray-500">
            {language === "ar" ? "نظرة شاملة على أداء برنامج الولاء" : "Comprehensive overview of loyalty program performance"}
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-[#1B2A5E]" />
          </div>
        ) : (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {kpis.map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${bg}`}>
                      <Icon className="w-5 h-5" style={{ color }} />
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-800">{value.toLocaleString()}</div>
                      <div className="text-xs text-gray-500">{label}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Rate Cards */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-sm text-gray-500 mb-1">
                  {language === "ar" ? "معدل المشاركة" : "Engagement Rate"}
                </div>
                <div className="text-3xl font-bold text-[#1B2A5E]">{engagementRate}%</div>
                <div className="text-xs text-gray-400 mt-1">
                  {language === "ar" ? "من العملاء نشطون خلال 30 يوم" : "of customers active in last 30 days"}
                </div>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#1B2A5E] rounded-full transition-all" style={{ width: `${engagementRate}%` }} />
                </div>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="text-sm text-gray-500 mb-1">
                  {language === "ar" ? "معدل اعتماد الفواتير" : "Invoice Approval Rate"}
                </div>
                <div className="text-3xl font-bold text-green-600">{approvalRate}%</div>
                <div className="text-xs text-gray-400 mt-1">
                  {language === "ar" ? "من الفواتير المقدمة تمت الموافقة عليها" : "of submitted invoices approved"}
                </div>
                <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${approvalRate}%` }} />
                </div>
              </div>
            </div>

            {/* Tier Distribution */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-700 mb-4">
                  {language === "ar" ? "توزيع المستويات" : "Tier Distribution"}
                </h3>
                {tierData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={tierData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {tierData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => [`${value} customers`, ""]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data yet</div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-semibold text-gray-700 mb-4">
                  {language === "ar" ? "العملاء حسب المستوى" : "Customers by Tier"}
                </h3>
                {tierBarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={tierBarData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="customers" radius={[6, 6, 0, 0]}>
                        {tierBarData.map((entry: any, index: number) => (
                          <Cell key={`bar-${index}`} fill={TIER_COLORS[entry.name as keyof typeof TIER_COLORS] ?? "#5B9BD5"} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-48 text-gray-400 text-sm">No data yet</div>
                )}
              </div>
            </div>

            {/* Summary Table */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-gray-700 mb-4">
                {language === "ar" ? "ملخص البرنامج" : "Program Summary"}
              </h3>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-gray-100">
                  {[
                    { label: "Total Customers Enrolled", value: analytics?.totalCustomers ?? 0 },
                    { label: "Active Customers (30 days)", value: analytics?.activeCustomers ?? 0 },
                    { label: "Approved Invoices", value: analytics?.approvedInvoices ?? 0 },
                    { label: "Pending Invoices", value: analytics?.pendingInvoices ?? 0 },
                    { label: "Total Reward Redemptions", value: analytics?.totalRedemptions ?? 0 },
                    { label: "Open Fraud Flags", value: analytics?.openFraudFlags ?? 0 },
                    { label: "Engagement Rate", value: `${engagementRate}%` },
                    { label: "Invoice Approval Rate", value: `${approvalRate}%` },
                  ].map(({ label, value }) => (
                    <tr key={label}>
                      <td className="py-2 text-gray-500">{label}</td>
                      <td className="py-2 text-right font-semibold text-gray-800">{value.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
