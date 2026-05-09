import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { ArrowUpRight, ArrowDownLeft, Star, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { getLoginUrl } from "@/const";

const TYPE_LABELS: Record<string, string> = {
  earn: "Points Earned",
  redeem: "Points Redeemed",
  expire: "Points Expired",
  bonus: "Bonus Points",
  manual: "Admin Adjustment",
  referral: "Referral Bonus",
};

const TYPE_COLORS: Record<string, string> = {
  earn: "text-green-600",
  bonus: "text-blue-600",
  referral: "text-purple-600",
  redeem: "text-red-500",
  expire: "text-orange-500",
  manual: "text-gray-600",
};

export default function Transactions() {
  const { isAuthenticated } = useAuth();
  const { data: transactions, isLoading } = trpc.transactions.history.useQuery(
    { limit: 100 },
    { enabled: isAuthenticated }
  );

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-[#1B2A5E] mb-4">Sign in to view transactions</h2>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <CustomerLayout>
      <div className="md:ml-56">
        <div className="prime-gradient text-white px-4 pt-6 pb-12">
          <div className="container max-w-lg">
            <h1 className="text-2xl font-bold mb-1">Transaction History</h1>
            <p className="text-white/70 text-sm">All your points activity</p>
          </div>
        </div>

        <div className="container max-w-lg -mt-8 pb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[#5B9BD5]" />
              </div>
            ) : !transactions || transactions.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Star size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No transactions yet</p>
                <p className="text-sm mt-1">Submit your first invoice to start earning!</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {transactions.map((tx) => {
                  const isPositive = tx.points > 0;
                  return (
                    <div key={tx.id} className="flex items-center gap-3 px-5 py-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isPositive ? "bg-green-100" : "bg-red-100"}`}>
                        {isPositive ? (
                          <ArrowUpRight size={18} className="text-green-600" />
                        ) : (
                          <ArrowDownLeft size={18} className="text-red-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 truncate">{tx.description}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-400">{TYPE_LABELS[tx.type] ?? tx.type}</span>
                          <span className="text-gray-200">·</span>
                          <span className="text-xs text-gray-400">{format(new Date(tx.createdAt), "MMM d, yyyy")}</span>
                        </div>
                      </div>
                      <span className={`text-sm font-bold ${TYPE_COLORS[tx.type] ?? (isPositive ? "text-green-600" : "text-red-500")}`}>
                        {isPositive ? "+" : ""}{tx.points} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </CustomerLayout>
  );
}
