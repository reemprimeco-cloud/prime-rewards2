import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { getLoginUrl } from "@/const";
import CustomerLayout from "@/components/CustomerLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { Award, Clock, Gift, Star, TrendingUp, FileText, RotateCcw, Bell, ChevronRight } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";
import { arSA } from "date-fns/locale";

const TIER_COLORS: Record<string, string> = {
  Bronze: "#CD7F32", Silver: "#94A3B8", Gold: "#F59E0B", Platinum: "#6366F1",
};
const TIER_BG: Record<string, string> = {
  Bronze: "from-amber-500 to-amber-700",
  Silver: "from-slate-400 to-slate-600",
  Gold: "from-yellow-400 to-yellow-600",
  Platinum: "from-indigo-500 to-indigo-700",
};
const TIER_NAMES_AR: Record<string, string> = {
  Bronze: "برونز", Silver: "فضي", Gold: "ذهبي", Platinum: "بلاتيني",
};

function CountdownTimer({ expiryDate, t, language }: { expiryDate: Date | null; t: any; language: string }) {
  if (!expiryDate) return null;
  const now = new Date();
  const expiry = new Date(expiryDate);
  if (expiry <= now) return <span className="text-red-500 text-xs font-medium">{language === "ar" ? "انتهت صلاحية النقاط" : "Points expired"}</span>;
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  const urgent = daysLeft <= 30;
  return (
    <div className={`flex items-center gap-1.5 text-xs font-medium ${urgent ? "text-red-400" : "text-white/70"}`}>
      <Clock size={12} />
      <span>{t.dash_expires_in} {daysLeft} {t.dash_days}</span>
    </div>
  );
}

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const { t, language, isRTL } = useLanguage();
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
          <h2 className="text-xl font-bold text-[#1B2A5E] mb-4">
            {language === "ar" ? "سجّل دخولك لعرض لوحة التحكم" : "Sign in to view your dashboard"}
          </h2>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">{t.login}</a>
        </div>
      </div>
    );
  }

  const tier = customer?.tier ?? "Bronze";
  const tierColor = TIER_COLORS[tier];
  const tierGradient = TIER_BG[tier];
  const tierDisplay = language === "ar" ? (TIER_NAMES_AR[tier] ?? tier) : tier;
  const unreadNotifs = notifications?.filter(n => !n.isRead) ?? [];

  return (
    <CustomerLayout>
      <div className={isRTL ? "md:mr-56" : "md:ml-56"}>
        {/* Hero Points Card */}
        <div className={`bg-gradient-to-br ${tierGradient} text-white px-4 pt-6 pb-16`}>
          <div className="container max-w-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-white/70 text-sm">{t.dash_welcome}</p>
                <h1 className="text-xl font-bold">{customer?.fullName ?? t.loading}</h1>
              </div>
              <div className="flex items-center gap-2 bg-white/20 rounded-full px-3 py-1.5">
                <Award size={16} />
                <span className="text-sm font-semibold">{tierDisplay}</span>
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
              <p className="text-white/80 text-sm mb-3">{t.dash_points_balance}</p>
              <CountdownTimer expiryDate={customer?.pointsExpiryDate ? new Date(customer.pointsExpiryDate) : null} t={t} language={language} />
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
              <h3 className="font-semibold text-gray-800">{t.dash_tier_status}</h3>
              <span className="text-xs text-gray-400">{customer?.lifetimePoints ?? 0} {t.points_abbr}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2">
              <div
                className="h-2.5 rounded-full transition-all duration-700"
                style={{ width: `${tierInfo?.progress ?? 0}%`, backgroundColor: tierColor }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span style={{ color: tierColor }} className="font-semibold">{tierDisplay}</span>
              {tierInfo?.nextTier ? (
                <span>
                  {tierInfo.nextThreshold
                    ? `${tierInfo.nextThreshold - (customer?.lifetimePoints ?? 0)} ${t.dash_points_to_next}`
                    : ""}
                </span>
              ) : (
                <span className="text-indigo-600 font-semibold">
                  {language === "ar" ? "أعلى مستوى!" : "Max Tier Reached!"}
                </span>
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
                <p className="text-xs text-gray-500">
                  {activeCampaigns[0].multiplier}x {language === "ar" ? "نقاط مضاعفة الآن!" : "points active now!"}
                </p>
              </div>
            </motion.div>
          )}

          {/* Quick Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <h3 className="font-semibold text-gray-700 mb-3 text-sm">{t.dash_quick_actions}</h3>
            <div className="grid grid-cols-2 gap-3">
              {[
                { href: "/invoices", icon: FileText, label: t.dash_submit_invoice },
                { href: "/spin", icon: RotateCcw, label: t.dash_spin_wheel },
                { href: "/rewards", icon: Gift, label: t.dash_browse_rewards },
                { href: "/transactions", icon: Star, label: t.nav_history },
              ].map(({ href, icon: Icon, label }) => (
                <Link key={href} href={href} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex flex-col items-center gap-2 hover:border-[#5B9BD5] transition-colors">
                  <div className="w-12 h-12 rounded-xl bg-[#EBF4FF] flex items-center justify-center">
                    <Icon size={22} className="text-[#1B2A5E]" />
                  </div>
                  <span className="text-sm font-semibold text-gray-700 text-center">{label}</span>
                </Link>
              ))}
            </div>
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
                  {t.notif_title}
                  <span className="bg-[#5B9BD5] text-white text-xs rounded-full px-2 py-0.5">{unreadNotifs.length}</span>
                </h3>
                <button onClick={() => markRead.mutate()} className="text-xs text-[#5B9BD5] font-medium">
                  {t.notif_mark_read}
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
              <h3 className="font-semibold text-gray-800">{t.dash_recent_activity}</h3>
              <Link href="/transactions" className="text-xs text-[#5B9BD5] font-medium flex items-center gap-1">
                {t.dash_view_all} <ChevronRight size={14} className={isRTL ? "rotate-180" : ""} />
              </Link>
            </div>
            {!transactions || transactions.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Star size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">{t.dash_no_activity}</p>
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
                      <p className="text-xs text-gray-400">
                        {formatDistanceToNow(new Date(tx.createdAt), {
                          addSuffix: true,
                          locale: language === "ar" ? arSA : undefined,
                        })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold ${tx.points > 0 ? "text-green-600" : "text-red-500"}`}>
                      {tx.points > 0 ? "+" : ""}{tx.points} {t.points_abbr}
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
