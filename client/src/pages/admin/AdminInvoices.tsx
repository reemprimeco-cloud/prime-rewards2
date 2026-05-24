import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { toast } from "sonner";
import { FileText, CheckCircle, XCircle, AlertTriangle, Clock, Loader2, Search, RotateCcw } from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG_EN = {
  pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", label: "Pending" },
  approved: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Approved" },
  rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: "Rejected" },
  flagged: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "Flagged" },
};
const STATUS_CONFIG_AR = {
  pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", label: "قيد المراجعة" },
  approved: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "معتمدة" },
  rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: "مرفوضة" },
  flagged: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "مُبلَّغ عنها" },
};

export default function AdminInvoices() {
  const { t, language, isRTL } = useLanguage();
  const STATUS_CONFIG = language === "ar" ? STATUS_CONFIG_AR : STATUS_CONFIG_EN;
  const { data: invoices, isLoading, refetch } = trpc.invoices.all.useQuery({ limit: 100, offset: 0 });
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "flagged">("all");
  const [search, setSearch] = useState("");
  const [rejectReason, setRejectReason] = useState<Record<number, string>>({});
  const utils = trpc.useUtils();

  const reviewMutation = trpc.invoices.review.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Invoice ${vars.status} successfully!`);
      refetch();
      utils.admin.analytics.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const resetClaimMutation = trpc.invoices.resetClaim.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم إعادة تعيين المطالبة بالفاتورة" : "Invoice claim reset to pending");
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = invoices?.filter(({ invoice, customer }) => {
    const matchFilter = filter === "all" || invoice.status === filter;
    const matchSearch = !search ||
      invoice.invoiceNumber.toLowerCase().includes(search.toLowerCase()) ||
      customer?.fullName?.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  }) ?? [];

  const pendingCount = invoices?.filter(({ invoice }) => invoice.status === "pending").length ?? 0;

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div>
          <h2 className="text-xl font-bold text-[#1B2A5E]">{t.admin_inv_title}</h2>
          <p className="text-sm text-gray-500">{pendingCount} {language === "ar" ? "قيد المراجعة" : "pending review"}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {(["all", "pending", "approved", "rejected", "flagged"] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-[#1B2A5E] text-white"
                  : "bg-white border border-gray-200 text-gray-600 hover:border-[#5B9BD5]"
              }`}
            >
              {f}
              {f === "pending" && pendingCount > 0 && (
                <span className="ml-1.5 bg-yellow-400 text-yellow-900 text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={language === "ar" ? "بحث برقم الفاتورة أو اسم العميل..." : "Search by invoice number or customer name..."}
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5B9BD5]"
          />
        </div>

        {/* Invoice List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-[#5B9BD5]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <FileText size={40} className="mx-auto mb-3 opacity-30" />
              <p>{language === "ar" ? "لا توجد فواتير" : "No invoices found"}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(({ invoice, customer }) => {
                const status = STATUS_CONFIG[invoice.status] ?? STATUS_CONFIG.pending;
                const StatusIcon = status.icon;
                return (
                  <div key={invoice.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-gray-800 text-sm">#{invoice.invoiceNumber}</p>
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                            <StatusIcon size={11} />
                            {status.label}
                          </div>
                          {invoice.multiplierApplied > 1 && (
                            <span className="text-xs bg-[#EBF4FF] text-[#5B9BD5] px-2 py-0.5 rounded-full">{invoice.multiplierApplied}x</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {customer?.fullName ?? (language === "ar" ? "غير معروف" : "Unknown")} · {format(new Date(invoice.submittedAt), "MMM d, yyyy h:mm a")}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-[#1B2A5E]">{parseFloat(String(invoice.invoiceAmount)).toLocaleString()} {t.currency}</p>
                        <p className="text-xs text-gray-400">{invoice.pointsEarned} {t.points_abbr}</p>
                      </div>
                    </div>

                    {/* Actions for pending */}
                    {invoice.status === "pending" && (
                      <div className="mt-3 space-y-2">
                        <input
                          value={rejectReason[invoice.id] ?? ""}
                          onChange={e => setRejectReason(r => ({ ...r, [invoice.id]: e.target.value }))}
                          placeholder={language === "ar" ? "سبب الرفض (اختياري)..." : "Rejection reason (optional)..."}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#5B9BD5]"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => reviewMutation.mutate({ invoiceId: invoice.id, status: "approved" })}
                            disabled={reviewMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 text-white py-2 rounded-lg text-xs font-semibold hover:bg-green-600"
                          >
                            <CheckCircle size={14} />
                            {t.admin_inv_approve}
                          </button>
                          <button
                            onClick={() => reviewMutation.mutate({
                              invoiceId: invoice.id,
                              status: "rejected",
                              rejectionReason: rejectReason[invoice.id]
                            })}
                            disabled={reviewMutation.isPending}
                            className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 text-white py-2 rounded-lg text-xs font-semibold hover:bg-red-600"
                          >
                            <XCircle size={14} />
                            {t.admin_inv_reject}
                          </button>
                          <button
                            onClick={() => reviewMutation.mutate({ invoiceId: invoice.id, status: "flagged" })}
                            disabled={reviewMutation.isPending}
                            className="flex items-center justify-center gap-1.5 bg-orange-400 text-white py-2 px-3 rounded-lg text-xs font-semibold hover:bg-orange-500"
                          >
                            <AlertTriangle size={14} />
                            {language === "ar" ? "إبلاغ" : "Flag"}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Reset Claim button for approved/rejected/flagged invoices */}
                    {(invoice.status === "approved" || invoice.status === "rejected" || invoice.status === "flagged") && (
                      <div className="mt-2">
                        <button
                          onClick={() => {
                            if (window.confirm(language === "ar" ? "هل تريد إعادة تعيين هذه الفاتورة إلى قيد المراجعة؟" : "Reset this invoice back to pending review?")) {
                              resetClaimMutation.mutate({ invoiceId: invoice.id });
                            }
                          }}
                          disabled={resetClaimMutation.isPending}
                          className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-[#1B2A5E] border border-gray-200 hover:border-[#1B2A5E] px-3 py-1.5 rounded-lg transition-colors"
                        >
                          <RotateCcw size={12} />
                          {language === "ar" ? "إعادة تعيين" : "Reset Claim"}
                        </button>
                      </div>
                    )}

                    {invoice.rejectionReason && (
                      <p className="text-xs text-red-400 mt-2 bg-red-50 px-3 py-2 rounded-lg">{invoice.rejectionReason}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
