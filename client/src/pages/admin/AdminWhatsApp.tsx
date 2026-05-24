import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
import { toast } from "sonner";
import { MessageCircle, CheckCircle, XCircle, Clock, RefreshCw, Loader2, Send } from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG = {
  sent: { color: "text-green-600", bg: "bg-green-50 border-green-200", label: "Sent", icon: CheckCircle },
  failed: { color: "text-red-500", bg: "bg-red-50 border-red-200", label: "Failed", icon: XCircle },
  pending: { color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-200", label: "Pending", icon: Clock },
  retrying: { color: "text-blue-600", bg: "bg-blue-50 border-blue-200", label: "Retrying", icon: RefreshCw },
};

const TYPE_LABELS: Record<string, string> = {
  points_awarded: "Points Awarded",
  welcome: "Welcome",
  tier_upgrade: "Tier Upgrade",
  reward_redeemed: "Reward Redeemed",
  expiry_warning: "Expiry Warning",
  spin_win: "Spin Win",
  manual: "Manual",
};

export default function AdminWhatsApp() {
  const [filter, setFilter] = useState<"all" | "sent" | "failed" | "pending">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: logs, isLoading, refetch } = trpc.whatsappLogs.list.useQuery({ limit: 200 });
  const resendMutation = trpc.whatsappLogs.resend.useMutation({
    onSuccess: () => {
      toast.success("Message resent successfully!");
      refetch();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const displayLogs = (logs ?? []).filter((l: any) => filter === "all" || l.log.status === filter);

  const stats = {
    total: logs?.length ?? 0,
    sent: logs?.filter((l: any) => l.log.status === "sent").length ?? 0,
    failed: logs?.filter((l: any) => l.log.status === "failed").length ?? 0,
    pending: logs?.filter((l: any) => l.log.status === "pending" || l.log.status === "retrying").length ?? 0,
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h2 className="text-xl font-bold text-[#1B2A5E]">WhatsApp Delivery Logs</h2>
          <p className="text-sm text-gray-500">Track all WhatsApp notifications sent to customers</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Total", value: stats.total, color: "text-[#1B2A5E]", bg: "bg-blue-50" },
            { label: "Sent", value: stats.sent, color: "text-green-600", bg: "bg-green-50" },
            { label: "Failed", value: stats.failed, color: "text-red-500", bg: "bg-red-50" },
            { label: "Pending", value: stats.pending, color: "text-yellow-600", bg: "bg-yellow-50" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "sent", "failed", "pending"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
                filter === f
                  ? "bg-[#1B2A5E] text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {/* Logs */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#1B2A5E]" />
          </div>
        ) : displayLogs.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <MessageCircle className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No WhatsApp logs found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayLogs.map((item: any) => {
              const log = item.log;
              const customer = item.customer;
              const statusCfg = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
              const StatusIcon = statusCfg.icon;
              const isExpanded = expandedId === log.id;

              return (
                <div key={log.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${statusCfg.bg}`}>
                          <StatusIcon className={`w-4 h-4 ${statusCfg.color}`} />
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium text-sm text-gray-800 truncate">
                            {customer?.fullName ?? log.phone}
                          </div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{log.phone}</span>
                            <span>·</span>
                            <span>{TYPE_LABELS[log.messageType] ?? log.messageType}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${statusCfg.bg} ${statusCfg.color}`}>
                          {statusCfg.label}
                        </span>
                        <span className="text-xs text-gray-400">
                          {format(new Date(log.createdAt), "MMM d, HH:mm")}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50 space-y-3">
                      <div className="bg-white rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap font-mono text-xs leading-relaxed border border-gray-100">
                        {log.messageBody}
                      </div>
                      {log.errorMessage && (
                        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
                          <span className="font-medium">Error:</span> {log.errorMessage}
                        </div>
                      )}
                      {log.messageSid && (
                        <div className="text-xs text-gray-500">
                          Message SID: <span className="font-mono">{log.messageSid}</span>
                        </div>
                      )}
                      {log.retryCount > 0 && (
                        <div className="text-xs text-gray-500">Retry attempts: {log.retryCount}</div>
                      )}
                      {(log.status === "failed" || log.status === "pending") && (
                        <button
                          onClick={() => resendMutation.mutate({ logId: log.id })}
                          disabled={resendMutation.isPending}
                          className="flex items-center gap-2 bg-[#1B2A5E] text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-[#243870] transition-colors disabled:opacity-50"
                        >
                          {resendMutation.isPending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          Resend Message
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
