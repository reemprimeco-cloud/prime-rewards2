import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { toast } from "sonner";
import { Shield, AlertTriangle, CheckCircle, XCircle, Loader2, Eye } from "lucide-react";
import { format } from "date-fns";

const REASON_LABELS: Record<string, string> = {
  duplicate_invoice: "Duplicate Invoice",
  excessive_submissions: "Excessive Submissions",
  suspicious_amount: "Suspicious Amount",
  manual_flag: "Manual Flag",
};

const STATUS_CONFIG = {
  open: { color: "text-red-500", bg: "bg-red-50", label: "Open" },
  reviewed: { color: "text-green-600", bg: "bg-green-50", label: "Reviewed" },
  dismissed: { color: "text-gray-500", bg: "bg-gray-50", label: "Dismissed" },
};

export default function AdminFraud() {
  const { t, language } = useLanguage();
  const { data: flags, isLoading, refetch } = trpc.fraud.list.useQuery({ status: "open", limit: 100 });
  const [filter, setFilter] = useState<"open" | "reviewed" | "dismissed">("open");
  const { data: allFlags, refetch: refetchAll } = trpc.fraud.list.useQuery({ limit: 200 });

  const reviewMutation = trpc.fraud.review.useMutation({
    onSuccess: () => {
      toast.success("Flag updated!");
      refetch();
      refetchAll();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const displayFlags = (filter === "open" ? flags : allFlags?.filter((f: { flag: { status: string } }) => f.flag.status === filter)) ?? [];

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h2 className="text-xl font-bold text-[#1B2A5E]">Fraud Protection Queue</h2>
          <p className="text-sm text-gray-500">Review suspicious activity and protect program integrity</p>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Open Flags", value: flags?.length ?? 0, color: "text-red-500", bg: "bg-red-50" },
            { label: "Reviewed", value: allFlags?.filter((f: { flag: { status: string } }) => f.flag.status === "reviewed").length ?? 0, color: "text-green-600", bg: "bg-green-50" },
            { label: "Dismissed", value: allFlags?.filter((f: { flag: { status: string } }) => f.flag.status === "dismissed").length ?? 0, color: "text-gray-500", bg: "bg-gray-50" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-2">
          {(["open", "reviewed", "dismissed"] as const).map(f => (
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
            </button>
          ))}
        </div>

        {/* Flags List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-[#5B9BD5]" />
            </div>
          ) : displayFlags.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Shield size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No {filter} flags</p>
              {filter === "open" && <p className="text-sm mt-1">Great! No suspicious activity detected.</p>}
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {displayFlags.map((item: { flag: { id: number; customerId: number; invoiceId: number | null; reason: string; details: string | null; status: string; createdAt: Date; reviewedBy: number | null }; customer: { fullName: string } | null }) => {
                const flag = item.flag;
                const statusCfg = STATUS_CONFIG[flag.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.open;
                return (
                  <div key={flag.id} className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle size={18} className="text-red-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <p className="font-semibold text-gray-800 text-sm">
                            {REASON_LABELS[flag.reason] ?? flag.reason}
                          </p>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                            {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">
                          Customer ID: {flag.customerId}
                          {flag.invoiceId ? ` · Invoice ID: ${flag.invoiceId}` : ""}
                          {" · "}
                          {format(new Date(flag.createdAt), "MMM d, yyyy h:mm a")}
                        </p>
                        {flag.details && (
                          <p className="text-xs text-gray-600 mt-1 bg-gray-50 px-3 py-2 rounded-lg">{flag.details}</p>
                        )}
                      </div>
                    </div>

                    {/* Actions for open flags */}
                    {flag.status === "open" && (
                      <div className="flex gap-2 mt-3 ml-13">
                        <button
                          onClick={() => reviewMutation.mutate({ flagId: flag.id, status: "reviewed" })}
                          disabled={reviewMutation.isPending}
                          className="flex items-center gap-1.5 bg-green-500 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-green-600"
                        >
                          <CheckCircle size={14} />
                          Mark Reviewed
                        </button>
                        <button
                          onClick={() => reviewMutation.mutate({ flagId: flag.id, status: "dismissed" })}
                          disabled={reviewMutation.isPending}
                          className="flex items-center gap-1.5 bg-gray-400 text-white px-4 py-2 rounded-lg text-xs font-semibold hover:bg-gray-500"
                        >
                          <XCircle size={14} />
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="bg-[#EBF4FF] rounded-2xl border border-[#5B9BD5]/20 p-5">
          <h3 className="font-semibold text-[#1B2A5E] mb-2 flex items-center gap-2">
            <Shield size={16} className="text-[#5B9BD5]" />
            Automatic Fraud Detection
          </h3>
          <ul className="space-y-1.5 text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5B9BD5] mt-1.5 flex-shrink-0" />
              Duplicate invoice numbers are automatically flagged
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5B9BD5] mt-1.5 flex-shrink-0" />
              More than 5 submissions per day triggers a review flag
            </li>
            <li className="flex items-start gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-[#5B9BD5] mt-1.5 flex-shrink-0" />
              {language === "ar" ? "الفواتير التي تتجاوز 50,000 د.ك تُرفع للمراجعة اليدوية" : "Invoices above 50,000 KD are flagged for manual review"}
            </li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
}
