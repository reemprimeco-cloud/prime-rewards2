import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
import { toast } from "sonner";
import { Users, Search, Award, Plus, Minus, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { format } from "date-fns";

const TIER_COLORS: Record<string, string> = {
  Bronze: "#CD7F32",
  Silver: "#94A3B8",
  Gold: "#F59E0B",
  Platinum: "#6366F1",
};

export default function AdminCustomers() {
  const { data: customers, isLoading, refetch } = trpc.admin.customers.useQuery({ limit: 100, offset: 0 });
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [adjustPoints, setAdjustPoints] = useState(0);
  const [adjustReason, setAdjustReason] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: customerDetail } = trpc.admin.customerDetail.useQuery(
    { customerId: selectedId! },
    { enabled: selectedId !== null }
  );

  const utils = trpc.useUtils();
  const adjustMutation = trpc.admin.adjustPoints.useMutation({
    onSuccess: () => {
      toast.success("Points adjusted successfully!");
      setSelectedId(null);
      setAdjustPoints(0);
      setAdjustReason("");
      refetch();
      utils.admin.analytics.invalidate();
    },
    onError: (err) => toast.error(err.message),
  });

  const filtered = customers?.filter(({ customer }) =>
    customer.fullName.toLowerCase().includes(search.toLowerCase()) ||
    customer.businessName?.toLowerCase().includes(search.toLowerCase()) ||
    customer.referralCode?.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <AdminLayout>
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1B2A5E]">Customers</h2>
            <p className="text-sm text-gray-500">{customers?.length ?? 0} registered customers</p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, business, or referral code..."
            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[#5B9BD5]"
          />
        </div>

        {/* Customer List */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-[#5B9BD5]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Users size={40} className="mx-auto mb-3 opacity-30" />
              <p>No customers found</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map(({ customer, user }) => {
                const tierColor = TIER_COLORS[customer.tier] ?? "#5B9BD5";
                const isExpanded = expandedId === customer.id;
                return (
                  <div key={customer.id}>
                    <div
                      className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setExpandedId(isExpanded ? null : customer.id)}
                    >
                      <div className="w-10 h-10 rounded-full bg-[#EBF4FF] flex items-center justify-center flex-shrink-0">
                        <span className="text-sm font-bold text-[#1B2A5E]">
                          {customer.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-800 text-sm">{customer.fullName}</p>
                        <p className="text-xs text-gray-400">{customer.businessName || user?.email || "—"}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="flex items-center gap-1.5 justify-end">
                          <Award size={14} style={{ color: tierColor }} />
                          <span className="text-xs font-semibold" style={{ color: tierColor }}>{customer.tier}</span>
                        </div>
                        <p className="text-sm font-bold text-[#1B2A5E]">{customer.totalPoints.toLocaleString()} pts</p>
                      </div>
                      {isExpanded ? <ChevronUp size={16} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />}
                    </div>

                    {/* Expanded Detail */}
                    {isExpanded && (
                      <div className="px-5 pb-5 bg-gray-50 border-t border-gray-100">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 mb-4">
                          <div className="bg-white rounded-xl p-3 text-center">
                            <div className="text-lg font-bold text-[#1B2A5E]">{customer.totalPoints}</div>
                            <div className="text-xs text-gray-500">Current Points</div>
                          </div>
                          <div className="bg-white rounded-xl p-3 text-center">
                            <div className="text-lg font-bold text-[#5B9BD5]">{customer.lifetimePoints}</div>
                            <div className="text-xs text-gray-500">Lifetime Points</div>
                          </div>
                          <div className="bg-white rounded-xl p-3 text-center">
                            <div className="text-lg font-bold text-gray-700">{customer.referralCode ?? "—"}</div>
                            <div className="text-xs text-gray-500">Referral Code</div>
                          </div>
                          <div className="bg-white rounded-xl p-3 text-center">
                            <div className="text-xs font-semibold text-gray-700">
                              {customer.createdAt ? format(new Date(customer.createdAt), "MMM d, yyyy") : "—"}
                            </div>
                            <div className="text-xs text-gray-500">Member Since</div>
                          </div>
                        </div>

                        {/* Adjust Points */}
                        <div className="bg-white rounded-xl p-4 border border-gray-100">
                          <h4 className="font-semibold text-sm text-gray-700 mb-3">Adjust Points</h4>
                          <div className="flex gap-2 mb-2">
                            <div className="flex items-center gap-2 flex-1">
                              <button
                                onClick={() => setAdjustPoints(p => p - 10)}
                                className="p-2 rounded-lg bg-red-50 text-red-500 hover:bg-red-100"
                              >
                                <Minus size={14} />
                              </button>
                              <input
                                type="number"
                                value={adjustPoints}
                                onChange={e => setAdjustPoints(parseInt(e.target.value) || 0)}
                                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center focus:outline-none focus:border-[#5B9BD5]"
                              />
                              <button
                                onClick={() => setAdjustPoints(p => p + 10)}
                                className="p-2 rounded-lg bg-green-50 text-green-600 hover:bg-green-100"
                              >
                                <Plus size={14} />
                              </button>
                            </div>
                          </div>
                          <input
                            value={adjustReason}
                            onChange={e => setAdjustReason(e.target.value)}
                            placeholder="Reason for adjustment..."
                            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:border-[#5B9BD5]"
                          />
                          <button
                            onClick={() => {
                              if (!adjustReason.trim()) { toast.error("Please provide a reason"); return; }
                              adjustMutation.mutate({ customerId: customer.id, points: adjustPoints, reason: adjustReason });
                              setSelectedId(customer.id);
                            }}
                            disabled={adjustMutation.isPending && selectedId === customer.id}
                            className="w-full bg-[#1B2A5E] text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2"
                          >
                            {adjustMutation.isPending && selectedId === customer.id ? <Loader2 size={14} className="animate-spin" /> : null}
                            Apply Adjustment ({adjustPoints > 0 ? "+" : ""}{adjustPoints} pts)
                          </button>
                        </div>
                      </div>
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
