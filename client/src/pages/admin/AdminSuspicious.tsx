import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { toast } from "sonner";
import { ShieldAlert, ShieldOff, ShieldCheck, Loader2, User, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

export default function AdminSuspicious() {
  const { data: accounts, isLoading, refetch } = trpc.suspicious.list.useQuery({ limit: 200 });

  const blockMutation = trpc.suspicious.block.useMutation({
    onSuccess: () => { toast.success("Account blocked."); refetch(); },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const unblockMutation = trpc.suspicious.unblock.useMutation({
    onSuccess: () => { toast.success("Account unblocked."); refetch(); },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const stats = {
    total: accounts?.length ?? 0,
    blocked: accounts?.filter((a: any) => a.suspicious.isBlocked).length ?? 0,
    active: accounts?.filter((a: any) => !a.suspicious.isBlocked).length ?? 0,
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div>
          <h2 className="text-xl font-bold text-[#1B2A5E]">Suspicious Accounts</h2>
          <p className="text-sm text-gray-500">Accounts flagged for unusual activity — review and block/unblock as needed</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Flagged", value: stats.total, color: "text-[#1B2A5E]", bg: "bg-blue-50" },
            { label: "Blocked", value: stats.blocked, color: "text-red-500", bg: "bg-red-50" },
            { label: "Under Review", value: stats.active, color: "text-yellow-600", bg: "bg-yellow-50" },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>

        {/* Accounts List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[#1B2A5E]" />
          </div>
        ) : (accounts?.length ?? 0) === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ShieldCheck className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p>No suspicious accounts detected</p>
          </div>
        ) : (
          <div className="space-y-3">
            {accounts!.map((item: any) => {
              const acc = item.suspicious;
              const customer = item.customer;
              const isBlocked = acc.isBlocked;

              return (
                <div key={acc.id} className={`bg-white rounded-2xl border shadow-sm p-4 ${isBlocked ? "border-red-200" : "border-yellow-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isBlocked ? "bg-red-100" : "bg-yellow-100"}`}>
                        {isBlocked ? (
                          <ShieldOff className="w-5 h-5 text-red-500" />
                        ) : (
                          <AlertTriangle className="w-5 h-5 text-yellow-600" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{customer?.fullName ?? `Customer #${acc.customerId}`}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isBlocked ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}>
                            {isBlocked ? "Blocked" : "Flagged"}
                          </span>
                        </div>
                        {customer?.phone && (
                          <div className="text-xs text-gray-500 mt-0.5">{customer.phone}</div>
                        )}
                        <div className="text-sm text-gray-600 mt-1">{acc.reason}</div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                          <span>Failed attempts: <strong className="text-red-500">{acc.failedAttemptCount}</strong></span>
                          <span>·</span>
                          <span>Flagged: {format(new Date(acc.createdAt), "MMM d, yyyy")}</span>
                          {acc.blockedAt && (
                            <>
                              <span>·</span>
                              <span>Blocked: {format(new Date(acc.blockedAt), "MMM d, yyyy")}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 flex-shrink-0">
                      {isBlocked ? (
                        <button
                          onClick={() => unblockMutation.mutate({ customerId: acc.customerId })}
                          disabled={unblockMutation.isPending}
                          className="flex items-center gap-1.5 bg-green-600 text-white px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-green-700 transition-colors disabled:opacity-50"
                        >
                          {unblockMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                          Unblock
                        </button>
                      ) : (
                        <button
                          onClick={() => blockMutation.mutate({ customerId: acc.customerId })}
                          disabled={blockMutation.isPending}
                          className="flex items-center gap-1.5 bg-red-600 text-white px-3 py-1.5 rounded-xl text-xs font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                        >
                          {blockMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldOff className="w-3 h-3" />}
                          Block
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
