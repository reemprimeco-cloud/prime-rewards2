import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
import { toast } from "sonner";
import {
  MessageCircle, CheckCircle, XCircle, Clock, RefreshCw,
  Loader2, Send, ChevronDown, ChevronUp, Wifi, AlertCircle,
} from "lucide-react";
import { format } from "date-fns";

const STATUS_CONFIG = {
  sent:     { color: "text-green-700",  bg: "bg-green-50  border-green-200",  dot: "bg-green-500",  label: "Sent",     Icon: CheckCircle },
  failed:   { color: "text-red-600",    bg: "bg-red-50    border-red-200",    dot: "bg-red-500",    label: "Failed",   Icon: XCircle     },
  pending:  { color: "text-yellow-700", bg: "bg-yellow-50 border-yellow-200", dot: "bg-yellow-500", label: "Pending",  Icon: Clock       },
  retrying: { color: "text-blue-700",   bg: "bg-blue-50   border-blue-200",   dot: "bg-blue-500",   label: "Retrying", Icon: RefreshCw   },
};

const TYPE_LABELS: Record<string, string> = {
  points_awarded:  "Points Awarded",
  welcome:         "Welcome",
  tier_upgrade:    "Tier Upgrade",
  reward_redeemed: "Reward Redeemed",
  expiry_warning:  "Expiry Warning",
  spin_win:        "Spin Win",
  manual:          "Manual",
};

export default function AdminWhatsApp() {
  const [filter, setFilter]     = useState<"all" | "sent" | "failed" | "pending">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [resendingId, setResendingId] = useState<number | null>(null);

  const { data: logs, isLoading, refetch } = trpc.whatsappLogs.list.useQuery({ limit: 300 });
  const resendMutation = trpc.whatsappLogs.resend.useMutation({
    onSuccess: (_data, vars) => {
      toast.success("Message resent — delivery in progress");
      setResendingId(null);
      refetch();
    },
    onError: (err: { message: string }) => {
      toast.error(err.message);
      setResendingId(null);
    },
  });

  const all = logs ?? [];
  const displayLogs = all.filter((l: any) =>
    filter === "all" ||
    l.log.status === filter ||
    (filter === "pending" && l.log.status === "retrying")
  );

  const stats = {
    total:   all.length,
    sent:    all.filter((l: any) => l.log.status === "sent").length,
    failed:  all.filter((l: any) => l.log.status === "failed").length,
    pending: all.filter((l: any) => l.log.status === "pending" || l.log.status === "retrying").length,
  };

  const deliveryRate = stats.total > 0 ? Math.round((stats.sent / stats.total) * 100) : 0;

  function handleResend(logId: number) {
    setResendingId(logId);
    resendMutation.mutate({ logId });
  }

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-5 pb-10">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-[#1B2A5E]">WhatsApp Delivery Logs</h2>
            <p className="text-sm text-gray-500 mt-0.5">All notifications sent via the official Prime Rewards sender</p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-1.5 text-sm text-[#1B2A5E] bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-xl transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Refresh
          </button>
        </div>

        {/* Sender badge */}
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
          <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <Wifi className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="text-sm font-semibold text-green-800">Prime Rewards · +1 555-968-2683</div>
            <div className="text-xs text-green-600">Official WhatsApp Business sender · Online</div>
          </div>
          <span className="ml-auto text-xs bg-green-500 text-white px-2 py-0.5 rounded-full font-medium">Active</span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total",    value: stats.total,   color: "text-[#1B2A5E]", bg: "bg-blue-50"   },
            { label: "Sent",     value: stats.sent,    color: "text-green-700", bg: "bg-green-50"  },
            { label: "Failed",   value: stats.failed,  color: "text-red-600",   bg: "bg-red-50"    },
            { label: "Pending",  value: stats.pending, color: "text-yellow-700",bg: "bg-yellow-50" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-2xl border border-gray-100 shadow-sm p-4 text-center`}>
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Delivery rate bar */}
        {stats.total > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-700">Delivery Rate</span>
              <span className="font-bold text-green-700">{deliveryRate}%</span>
            </div>
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-green-500 rounded-full transition-all duration-500"
                style={{ width: `${deliveryRate}%` }}
              />
            </div>
            <div className="text-xs text-gray-400 mt-1">{stats.sent} of {stats.total} messages delivered</div>
          </div>
        )}

        {/* Filter tabs */}
        <div className="flex gap-2 flex-wrap">
          {(["all", "sent", "failed", "pending"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-all ${
                filter === f
                  ? "bg-[#1B2A5E] text-white shadow-sm"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f}
              {f !== "all" && (
                <span className="ml-1.5 text-xs opacity-70">
                  {f === "sent" ? stats.sent : f === "failed" ? stats.failed : stats.pending}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Logs list */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 animate-spin text-[#1B2A5E]" />
          </div>
        ) : displayLogs.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 opacity-25" />
            <p className="font-medium">No messages found</p>
            <p className="text-sm mt-1">WhatsApp logs will appear here after invoices are approved</p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayLogs.map((item: any) => {
              const log      = item.log;
              const customer = item.customer;
              const cfg      = STATUS_CONFIG[log.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
              const { Icon } = cfg;
              const isExpanded = expandedId === log.id;
              const isSending  = resendingId === log.id;
              const canResend  = log.status === "failed" || log.status === "pending";

              return (
                <div key={log.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                  {/* Row */}
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50/70 transition-colors select-none"
                    onClick={() => setExpandedId(isExpanded ? null : log.id)}
                  >
                    <div className="flex items-center gap-3">
                      {/* Status icon */}
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${cfg.bg} border`}>
                        <Icon className={`w-4 h-4 ${cfg.color}`} />
                      </div>

                      {/* Info */}
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-sm text-gray-800 truncate">
                          {customer?.fullName ?? "Unknown"}
                        </div>
                        <div className="text-xs text-gray-500 flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          <span className="font-mono">{log.phone}</span>
                          <span className="hidden sm:inline">·</span>
                          <span className="hidden sm:inline">{TYPE_LABELS[log.messageType] ?? log.messageType}</span>
                          {log.invoiceId && <span className="hidden sm:inline">· Invoice #{log.invoiceId}</span>}
                        </div>
                      </div>

                      {/* Right side */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                        <span className="text-xs text-gray-400 hidden sm:block">
                          {format(new Date(log.createdAt), "MMM d, HH:mm")}
                        </span>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400" />
                        )}
                      </div>
                    </div>

                    {/* Mobile-only secondary row */}
                    <div className="sm:hidden mt-2 flex items-center gap-2 text-xs text-gray-400 pl-12">
                      <span>{TYPE_LABELS[log.messageType] ?? log.messageType}</span>
                      <span>·</span>
                      <span>{format(new Date(log.createdAt), "MMM d, HH:mm")}</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 p-4 bg-gray-50/60 space-y-3">
                      {/* Message body */}
                      <div className="bg-white rounded-xl p-3 text-xs text-gray-700 whitespace-pre-wrap font-mono leading-relaxed border border-gray-100 max-h-48 overflow-y-auto">
                        {log.messageBody}
                      </div>

                      {/* Meta info */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
                        {log.messageSid && (
                          <div className="col-span-2 bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <span className="font-medium text-gray-600">Message SID:</span>{" "}
                            <span className="font-mono">{log.messageSid}</span>
                          </div>
                        )}
                        {log.retryCount > 0 && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <span className="font-medium text-gray-600">Retry attempts:</span> {log.retryCount}
                          </div>
                        )}
                        {log.invoiceId && (
                          <div className="bg-white rounded-lg px-3 py-2 border border-gray-100">
                            <span className="font-medium text-gray-600">Invoice ID:</span> #{log.invoiceId}
                          </div>
                        )}
                      </div>

                      {/* Error */}
                      {log.errorMessage && (
                        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          <span>{log.errorMessage}</span>
                        </div>
                      )}

                      {/* Resend button */}
                      {canResend && (
                        <button
                          onClick={() => handleResend(log.id)}
                          disabled={isSending || resendMutation.isPending}
                          className="flex items-center gap-2 bg-[#1B2A5E] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-[#243870] transition-colors disabled:opacity-50 w-full sm:w-auto justify-center"
                        >
                          {isSending ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Send className="w-4 h-4" />
                          )}
                          {isSending ? "Sending…" : "Resend Message"}
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
