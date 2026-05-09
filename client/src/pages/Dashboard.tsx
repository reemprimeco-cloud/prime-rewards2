import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import CustomerLayout from "@/components/CustomerLayout";
import { motion } from "framer-motion";
import { Award, Clock, Gift, Star, TrendingUp, FileText, RotateCcw, Bell, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

const TIER_COLORS: Record<string, string> = {
  Bronze: "#CD7F32",
  Silver: "#94A3B8",
  Gold: "#F59E0B",
  Platinum: "#6366F1",
};

const TIER_BG: Record<string, string> = {
  Bronze: "from-amber-500 to-amber-700",
  Silver: "from-slate-400 to-slate-600",
  Gold: "from-yellow-400 to-yellow-600",
  Platinum: "from-indigo-500 to-indigo-700",
};

function CountdownTimer({ expiryDate }: { expiryDate: Date | null }) {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (expiry <= now) return <span className="text-red-500 text-xs font-medium">Points expired</span>;

  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const urgent = daysLeft <= 30;

  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${urgent ? "text-red-500" : "text-gray-500"}`}>
      <Clock size={12} />
      <span>Points expire in {daysLeft} days</span>
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const { data: customer, isLoading } = trpc.customer.me.useQuery(undefined, { enabled: isAuthenticated });
  const { data: tierInfo } = trpc.customer.tierInfo.useQuery(undefined, { enabled: isAuthenticated });
  const { data: transactions } = trpc.transactions.history.useQuery({ limit: 5 }, { enabled: isAuthenticated });
  const { data: activeCampaigns } = trpc.campaigns.active.useQuery();
  const { data: notifications } = trpc.notifications.list.useQuery(undefined, { enabled: isAuthenticated });
  const markRead = trpc.notifications.markRead.useMutation();

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-[#1B2A5E] mb-4">Sign in to view your dashboard</h2>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">Sign In</a>
        </div>
      </div>
    );
  }

  const tier = customer?.tier ?? "Bronze";
  const tierColor = TIER_COLORS[tier];
  const tierGradient = TIER_BG[tier];
  const unreadNotifs = notifications?.filter(n => !n.isRead) ?? [];

  return (
    <CustomerLayout>
      <div className="md:ml-56">
        {/* Hero Points Card */}
        <div className={`bg-gradient-to-br ${tierGradient} text-white px-4 pt-6 pb-16`}>
          <div className="container max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-white/70 text-sm">Welcome back</p>
                <h1 className="text-xl font-bold">{customer?.fullName ?? "Loading..."}</h1>
              </div>
              <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5">
                <Award size={16} />
                <span className="text-sm font-semibold">{tier}</span>
              </div>
            </div>
            <div className="text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl font-bold mb-1"
              >
                {isLoading ? "—" : (customer?.totalPoints ?? 0).toLocaleString()}
              </motion.div>
              <p className="text-white/80 text-sm mb-3">Available Points</p>
              <CountdownTimer expiryDate={customer?.pointsExpiryDate ? new Date(customer.pointsExpiryDate) : null} />
            </div>
          </div>
        </div>

        <div className="container max-w-2xl -mt-10 pb-6 space-y-4">
          {/* Tier Progress Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">Tier Progress</h3>
              <span className="text-xs text-gray-400">{customer?.lifetimePoints ?? 0} lifetime pts</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
              <div
                className="h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${tierInfo?.progress ?? 0}%`, backgroundColor: tierColor }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span style={{ color: tierColor }} className="font-semibold">{tier}</span>
              {tierInfo?.nextTier ? (
                <span>{tierInfo.nextThreshold ? `${tierInfo.nextThreshold - (customer?.lifetimePoints ?? 0)} pts to ${tierInfo.nextTier}` : ""}</span>
              ) : (
                <span className="text-indigo-600 font-semibold">Max Tier Reached!</span>
              )}
            </div>
          </motion.div>

          {/* Active Campaign Banner */}
          {activeCampaigns && activeCampaigns.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-[#EBF4FF] border border-[#5B9BD5]/30 rounded-2xl p-4 flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-[#5B9BD5] flex items-center justify-center flex-shrink-0">
                <TrendingUp size={20} className="text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-[#1B2A5E] text-sm">{activeCampaigns[0].name}</p>
                <p className="text-xs text-gray-500">{activeCampaigns[0].multiplier}x points active now!</p>
              </div>
            </motion.div>
          )}

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="grid grid-cols-2 gap-3"
          >
            <Link href="/invoices" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-[#5B9BD5] transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#EBF4FF] flex items-center justify-center">
                <FileText size={22} className="text-[#1B2A5E]" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Submit Invoice</span>
            </Link>
            <Link href="/spin" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-[#5B9BD5] transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#EBF4FF] flex items-center justify-center">
                <RotateCcw size={22} className="text-[#1B2A5E]" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Spin & Win</span>
            </Link>
            <Link href="/rewards" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-[#5B9BD5] transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#EBF4FF] flex items-center justify-center">
                <Gift size={22} className="text-[#1B2A5E]" />
              </div>
              <span className="text-sm font-semibold text-gray-700">Rewards Store</span>
            </Link>
            <Link href="/transactions" className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-[#5B9BD5] transition-colors">
              <div className="w-12 h-12 rounded-xl bg-[#EBF4FF] flex items-center justify-center">
                <Star size={22} className="text-[#1B2A5E]" />
              </div>
              <span className="text-sm font-semibold text-gray-700">History</span>
            </Link>
          </motion.div>

          {/* Recent Notifications */}
          {unreadNotifs.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <Bell size={16} className="text-[#5B9BD5]" />
                  Notifications
                  <span className="bg-[#5B9BD5] text-white text-xs rounded-full px-2 py-0.5">{unreadNotifs.length}</span>
                </h3>
                <button
                  onClick={() => markRead.mutate()}
                  className="text-xs text-[#5B9BD5] font-medium"
                >
                  Mark all read
                </button>
              </div>
              <div className="space-y-2">
                {unreadNotifs.slice(0, 3).map((n) => (
                  <div key={n.id} className="flex gap-3 p-3 bg-[#EBF4FF] rounded-xl">
                    <div className="w-8 h-8 rounded-full bg-[#5B9BD5] flex items-center justify-center flex-shrink-0">
                      <Bell size={14} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1B2A5E]">{n.title}</p>
                      <p className="text-xs text-gray-500 truncate">{n.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Recent Transactions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Recent Activity</h3>
              <Link href="/transactions" className="text-xs text-[#5B9BD5] font-medium flex items-center gap-1">
                View all <ChevronRight size={14} />
              </Link>
            </div>
            {!transactions || transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Star size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No transactions yet. Submit your first invoice!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${tx.points > 0 ? "bg-green-100" : "bg-red-100"}`}>
                      <Star size={16} className={tx.points > 0 ? "text-green-600" : "text-red-500"} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{tx.description}</p>
                      <p className="text-xs text-gray-400">{formatDistanceToNow(new Date(tx.createdAt), { addSuffix: true })}</p>
                    </div>
                    <span className={`text-sm font-bold ${tx.points > 0 ? "text-green-600" : "text-red-500"}`}>
                      {tx.points > 0 ? "+" : ""}{tx.points} pts
                    </span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </CustomerLayout>
  );
}
