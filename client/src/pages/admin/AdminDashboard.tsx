import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Users, FileText, Gift, AlertTriangle, TrendingUp, Clock, Award, BarChart2, Bell } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const TIER_COLORS = {
  Bronze: "#CD7F32",
  Silver: "#94A3B8",
  Gold: "#F59E0B",
  Platinum: "#6366F1",
};

export default function AdminDashboard() {
  const { t, language } = useLanguage();
  const { data: analytics, isLoading } = trpc.admin.analytics.useQuery();
  const { data: unreadNotifications } = trpc.adminNotifications.unreadCount.useQuery();

  const tierData = analytics?.tierCounts?.map(t => ({
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
      icon: FileText,
      color: "#5B9BD5",
      bg: "bg-sky-50",
    },
    {
      label: language === "ar" ? "فواتير معلقة" : "Pending Invoices",
      value: analytics?.pendingInvoices ?? 0,
      icon: Clock,
      color: "#F59E0B",
      bg: "bg-yellow-50",
    },
    {
      label: language === "ar" ? "إجمالي الاستبدالات" : "Total Redemptions",
      value: analytics?.totalRedemptions ?? 0,
      icon: Gift,
      color: "#6366F1",
      bg: "bg-indigo-50",
    },
    {
      label: language === "ar" ? "تنبيهات الاحتيال" : "Open Fraud Flags",
      value: analytics?.openFraudFlags ?? 0,
      icon: AlertTriangle,
      color: "#EF4444",
      bg: "bg-red-50",
    },
    {
      label: language === "ar" ? "إشعارات بالانتظار" : "Pending Notifications",
      value: unreadNotifications ?? 0,
      icon: Bell,
      color: "#F59E0B",
      bg: "bg-amber-50",
    },
  ];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[#1B2A5E]">{language === "ar" ? "نظرة عامة" : "Overview"}</h2>
          <p className="text-sm text-gray-500">{language === "ar" ? "تحليلات برنامج Prime Rewards" : "Prime Rewards program analytics"}</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {kpis.map(({ label, value, icon: Icon, color, bg }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5"
            >
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon size={20} style={{ color }} />
              </div>
              <div className="text-2xl font-bold text-gray-900">{isLoading ? "—" : value.toLocaleString()}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </motion.div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Tier Distribution */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Award size={18} className="text-[#5B9BD5]" />
              Customer Tier Distribution
            </h3>
            {tierData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-gray-400 text-sm">No data yet</div>
            ) : (
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
                    {tierData.map((entry, index) => (
                      <Cell key={index} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(val: number) => [`${val} customers`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            )}
            <div className="flex flex-wrap gap-3 mt-2 justify-center">
              {tierData.map(t => (
                <div key={t.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: t.color }} />
                  {t.name}: {t.value}
                </div>
              ))}
            </div>
          </div>

          {/* Invoice Status */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <BarChart2 size={18} className="text-[#5B9BD5]" />
              Invoice & Activity Summary
            </h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={[
                  { name: "Approved", value: analytics?.approvedInvoices ?? 0, fill: "#10B981" },
                  { name: "Pending", value: analytics?.pendingInvoices ?? 0, fill: "#F59E0B" },
                  { name: "Redemptions", value: analytics?.totalRedemptions ?? 0, fill: "#6366F1" },
                  { name: "Fraud Flags", value: analytics?.openFraudFlags ?? 0, fill: "#EF4444" },
                ]}
                margin={{ top: 5, right: 5, left: -20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {[
                    { fill: "#10B981" },
                    { fill: "#F59E0B" },
                    { fill: "#6366F1" },
                    { fill: "#EF4444" },
                  ].map((entry, index) => (
                    <Cell key={index} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Quick Links */}
        <div className="bg-[#EBF4FF] rounded-2xl border border-[#5B9BD5]/20 p-5">
          <h3 className="font-semibold text-[#1B2A5E] mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { href: "/admin/invoices", label: "Review Invoices", icon: FileText, badge: analytics?.pendingInvoices },
              { href: "/admin/customers", label: "Manage Customers", icon: Users },
              { href: "/admin/campaigns", label: "Create Campaign", icon: TrendingUp },
              { href: "/admin/fraud", label: "Fraud Queue", icon: AlertTriangle, badge: analytics?.openFraudFlags },
            ].map(({ href, label, icon: Icon, badge }) => (
              <a
                key={href}
                href={href}
                className="flex items-center gap-2 bg-white rounded-xl px-4 py-3 text-sm font-medium text-[#1B2A5E] hover:shadow-sm transition-shadow relative"
              >
                <Icon size={16} className="text-[#5B9BD5]" />
                {label}
                {badge ? (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] rounded-full flex items-center justify-center font-bold">
                    {badge}
                  </span>
                ) : null}
              </a>
            ))}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
