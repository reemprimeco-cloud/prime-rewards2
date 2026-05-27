import { useEffect, useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { format } from "date-fns";
import { ar } from "date-fns/locale";

interface QBSyncLog {
  id: number;
  qbInvoiceId: string;
  invoiceNumber: string;
  customerPhone: string;
  customerName?: string;
  amount: string;
  pointsCalculated: number;
  status: "pending" | "success" | "failed";
  customerId?: number;
  pendingRewardId?: number;
  pointsPending?: number;
  errorMessage?: string;
  processedAt?: Date;
  createdAt: Date;
}

interface PendingReward {
  id: number;
  phone: string;
  customerName?: string;
  invoiceNumber: string;
  amount: string;
  pointsEarned: number;
  status: "pending" | "claimed" | "expired";
  customerId?: number;
  claimedAt?: Date;
  expiresAt?: Date;
  createdAt: Date;
}

export function AdminQBSyncLogs() {
  const { language } = useLanguage();
  const isArabic = language === "ar";
  const [syncLogs, setSyncLogs] = useState<QBSyncLog[]>([]);
  const [pendingRewards, setPendingRewards] = useState<PendingReward[]>([]);
  const [activeTab, setActiveTab] = useState<"syncs" | "pending">("syncs");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "failed" | "pending">("all");

  // Mock data - in production, these would be actual API calls
  useEffect(() => {
    // Simulate fetching QB sync logs
    const mockSyncLogs: QBSyncLog[] = [
      {
        id: 1,
        qbInvoiceId: "qb-inv-001",
        invoiceNumber: "INV-2024-001",
        customerPhone: "whatsapp:+96550001234",
        customerName: "Ahmed Al-Dosari",
        amount: "100.00",
        pointsCalculated: 10,
        status: "success",
        customerId: 5,
        processedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: 2,
        qbInvoiceId: "qb-inv-002",
        invoiceNumber: "INV-2024-002",
        customerPhone: "whatsapp:+96550002345",
        customerName: "Fatima Al-Rashid",
        amount: "250.00",
        pointsCalculated: 25,
        status: "success",
        customerId: 8,
        processedAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000),
      },
      {
        id: 3,
        qbInvoiceId: "qb-inv-003",
        invoiceNumber: "INV-2024-003",
        customerPhone: "whatsapp:+96550003456",
        customerName: "Mohammed Al-Sabah",
        amount: "75.00",
        pointsCalculated: 7,
        status: "pending",
        pendingRewardId: 1,
        pointsPending: 7,
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: 4,
        qbInvoiceId: "qb-inv-004",
        invoiceNumber: "INV-2024-004",
        customerPhone: "whatsapp:+96550004567",
        amount: "150.00",
        pointsCalculated: 15,
        status: "failed",
        errorMessage: "WhatsApp send failed: Invalid phone number",
        createdAt: new Date(Date.now() - 10 * 60 * 1000),
      },
    ];

    const mockPendingRewards: PendingReward[] = [
      {
        id: 1,
        phone: "whatsapp:+96550003456",
        customerName: "Mohammed Al-Sabah",
        invoiceNumber: "INV-2024-003",
        amount: "75.00",
        pointsEarned: 7,
        status: "pending",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 30 * 60 * 1000),
      },
      {
        id: 2,
        phone: "whatsapp:+96550005678",
        customerName: "Noor Al-Mutairi",
        invoiceNumber: "INV-2024-005",
        amount: "200.00",
        pointsEarned: 20,
        status: "pending",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 60 * 60 * 1000),
      },
      {
        id: 3,
        phone: "whatsapp:+96550006789",
        customerName: "Sara Al-Khaled",
        invoiceNumber: "INV-2024-006",
        amount: "120.00",
        pointsEarned: 12,
        status: "claimed",
        customerId: 12,
        claimedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000),
      },
    ];

    setSyncLogs(mockSyncLogs);
    setPendingRewards(mockPendingRewards);
  }, []);

  const filteredSyncLogs = syncLogs.filter((log) => {
    if (statusFilter === "all") return true;
    return log.status === statusFilter;
  });

  const stats = {
    totalSyncs: syncLogs.length,
    successfulSyncs: syncLogs.filter((l) => l.status === "success").length,
    failedSyncs: syncLogs.filter((l) => l.status === "failed").length,
    pendingSyncs: syncLogs.filter((l) => l.status === "pending").length,
    totalPointsProcessed: syncLogs
      .filter((l) => l.status === "success")
      .reduce((sum, l) => sum + l.pointsCalculated, 0),
    totalPendingRewards: pendingRewards.filter((r) => r.status === "pending").length,
    totalClaimedRewards: pendingRewards.filter((r) => r.status === "claimed").length,
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "success":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "claimed":
        return "bg-blue-100 text-blue-800";
      case "expired":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDate = (date: Date) => {
    return format(new Date(date), isArabic ? "PPpp" : "PPpp", {
      locale: isArabic ? ar : undefined,
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            {isArabic ? "سجلات مزامنة QuickBooks" : "QB Sync Logs"}
          </h1>
          <p className="text-light-blue-300">
            {isArabic
              ? "مراقبة معالجة دفعات QuickBooks والمكافآت المعلقة"
              : "Monitor QuickBooks payment processing and pending rewards"}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-4 border border-white/20">
            <p className="text-light-blue-300 text-sm">{isArabic ? "إجمالي المزامنات" : "Total Syncs"}</p>
            <p className="text-2xl font-bold text-white mt-1">{stats.totalSyncs}</p>
          </div>
          <div className="bg-green-500/20 backdrop-blur-md rounded-lg p-4 border border-green-500/30">
            <p className="text-green-300 text-sm">{isArabic ? "ناجحة" : "Successful"}</p>
            <p className="text-2xl font-bold text-green-400 mt-1">{stats.successfulSyncs}</p>
          </div>
          <div className="bg-red-500/20 backdrop-blur-md rounded-lg p-4 border border-red-500/30">
            <p className="text-red-300 text-sm">{isArabic ? "فشلت" : "Failed"}</p>
            <p className="text-2xl font-bold text-red-400 mt-1">{stats.failedSyncs}</p>
          </div>
          <div className="bg-yellow-500/20 backdrop-blur-md rounded-lg p-4 border border-yellow-500/30">
            <p className="text-yellow-300 text-sm">{isArabic ? "معلقة" : "Pending"}</p>
            <p className="text-2xl font-bold text-yellow-400 mt-1">{stats.pendingSyncs}</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-white/20">
          <button
            onClick={() => setActiveTab("syncs")}
            className={`px-4 py-3 font-semibold transition-colors ${
              activeTab === "syncs"
                ? "text-light-blue-400 border-b-2 border-light-blue-400"
                : "text-light-blue-300 hover:text-light-blue-400"
            }`}
          >
            {isArabic ? "سجلات المزامنة" : "Sync Logs"}
          </button>
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-3 font-semibold transition-colors ${
              activeTab === "pending"
                ? "text-light-blue-400 border-b-2 border-light-blue-400"
                : "text-light-blue-300 hover:text-light-blue-400"
            }`}
          >
            {isArabic ? "المكافآت المعلقة" : "Pending Rewards"} ({stats.totalPendingRewards})
          </button>
        </div>

        {/* Sync Logs Tab */}
        {activeTab === "syncs" && (
          <div className="space-y-4">
            {/* Filter */}
            <div className="flex gap-2 mb-4">
              {(["all", "success", "failed", "pending"] as const).map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                    statusFilter === status
                      ? "bg-light-blue-500 text-white"
                      : "bg-white/10 text-light-blue-300 hover:bg-white/20"
                  }`}
                >
                  {status === "all"
                    ? isArabic
                      ? "الكل"
                      : "All"
                    : status === "success"
                      ? isArabic
                        ? "ناجح"
                        : "Success"
                      : status === "failed"
                        ? isArabic
                          ? "فشل"
                          : "Failed"
                        : isArabic
                          ? "معلق"
                          : "Pending"}
                </button>
              ))}
            </div>

            {/* Logs Table */}
            <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-white/5 border-b border-white/20">
                    <tr>
                      <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                        {isArabic ? "رقم الفاتورة" : "Invoice #"}
                      </th>
                      <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                        {isArabic ? "الهاتف" : "Phone"}
                      </th>
                      <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                        {isArabic ? "المبلغ" : "Amount"}
                      </th>
                      <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                        {isArabic ? "النقاط" : "Points"}
                      </th>
                      <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                        {isArabic ? "الحالة" : "Status"}
                      </th>
                      <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                        {isArabic ? "الوقت" : "Time"}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {filteredSyncLogs.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-8 text-center text-light-blue-300">
                          {isArabic ? "لا توجد سجلات" : "No logs found"}
                        </td>
                      </tr>
                    ) : (
                      filteredSyncLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-white font-medium">{log.invoiceNumber}</td>
                          <td className="px-4 py-3 text-light-blue-300 text-xs">
                            {log.customerPhone.replace("whatsapp:", "")}
                          </td>
                          <td className="px-4 py-3 text-white">{log.amount} KD</td>
                          <td className="px-4 py-3 text-light-blue-400 font-semibold">{log.pointsCalculated}</td>
                          <td className="px-4 py-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(log.status)}`}>
                              {log.status === "success"
                                ? isArabic
                                  ? "ناجح"
                                  : "Success"
                                : log.status === "failed"
                                  ? isArabic
                                    ? "فشل"
                                    : "Failed"
                                  : isArabic
                                    ? "معلق"
                                    : "Pending"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-light-blue-300 text-xs">
                            {formatDate(log.processedAt || log.createdAt)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Error Details */}
            {syncLogs.some((l) => l.errorMessage) && (
              <div className="bg-red-500/10 backdrop-blur-md rounded-lg border border-red-500/30 p-4">
                <h3 className="text-red-400 font-semibold mb-3">
                  {isArabic ? "رسائل الخطأ" : "Error Messages"}
                </h3>
                <div className="space-y-2">
                  {syncLogs
                    .filter((l) => l.errorMessage)
                    .map((log) => (
                      <div key={log.id} className="text-red-300 text-sm">
                        <strong>{log.invoiceNumber}:</strong> {log.errorMessage}
                      </div>
                    ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Pending Rewards Tab */}
        {activeTab === "pending" && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg border border-white/20 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white/5 border-b border-white/20">
                  <tr>
                    <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                      {isArabic ? "رقم الفاتورة" : "Invoice #"}
                    </th>
                    <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                      {isArabic ? "الهاتف" : "Phone"}
                    </th>
                    <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                      {isArabic ? "النقاط" : "Points"}
                    </th>
                    <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                      {isArabic ? "الحالة" : "Status"}
                    </th>
                    <th className="px-4 py-3 text-left text-light-blue-300 font-semibold">
                      {isArabic ? "ينتهي في" : "Expires"}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {pendingRewards.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-light-blue-300">
                        {isArabic ? "لا توجد مكافآت معلقة" : "No pending rewards"}
                      </td>
                    </tr>
                  ) : (
                    pendingRewards.map((reward) => (
                      <tr key={reward.id} className="hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 text-white font-medium">{reward.invoiceNumber}</td>
                        <td className="px-4 py-3 text-light-blue-300 text-xs">
                          {reward.phone.replace("whatsapp:", "")}
                        </td>
                        <td className="px-4 py-3 text-light-blue-400 font-semibold">{reward.pointsEarned}</td>
                        <td className="px-4 py-3">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusBadgeColor(reward.status)}`}>
                            {reward.status === "pending"
                              ? isArabic
                                ? "معلق"
                                : "Pending"
                              : reward.status === "claimed"
                                ? isArabic
                                  ? "مطالب به"
                                  : "Claimed"
                                : isArabic
                                  ? "انتهت صلاحيته"
                                  : "Expired"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-light-blue-300 text-xs">
                          {reward.expiresAt ? formatDate(reward.expiresAt) : "-"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
