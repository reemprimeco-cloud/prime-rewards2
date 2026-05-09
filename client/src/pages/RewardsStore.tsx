import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Star, CheckCircle, Loader2, Tag, Truck, Palette, Zap, Package } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

const REWARD_ICONS: Record<string, React.ElementType> = {
  discount: Tag,
  free_service: Package,
  merchandise: Gift,
  free_delivery: Truck,
  free_design: Palette,
  double_points: Zap,
};

const REWARD_COLORS: Record<string, string> = {
  discount: "#5B9BD5",
  free_service: "#6366F1",
  merchandise: "#F59E0B",
  free_delivery: "#10B981",
  free_design: "#EC4899",
  double_points: "#F97316",
};

export default function RewardsStore() {
  const { isAuthenticated } = useAuth();
  const { t, language, isRTL } = useLanguage();
  const { data: rewards, isLoading } = trpc.rewards.list.useQuery();
  const { data: customer } = trpc.customer.me.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myRedemptions, refetch: refetchRedemptions } = trpc.rewards.myRedemptions.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const redeemMutation = trpc.rewards.redeem.useMutation({
    onSuccess: (data) => {
      toast.success(`Reward redeemed! Your coupon: ${data.couponCode}`, { duration: 8000 });
      utils.customer.me.invalidate();
      refetchRedemptions();
      setConfirmReward(null);
    },
    onError: (err) => {
      toast.error(err.message);
      setConfirmReward(null);
    },
  });

  const [confirmReward, setConfirmReward] = useState<number | null>(null);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-[#1B2A5E] mb-4">
            {language === "ar" ? "سجّل دخولك لعرض المكافآت" : "Sign in to view rewards"}
          </h2>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">{t.login}</a>
        </div>
      </div>
    );
  }

  return (
    <CustomerLayout>
      <div className={isRTL ? "md:mr-56" : "md:ml-56"}>
        {/* Header */}
        <div className="prime-gradient text-white px-4 pt-6 pb-12">
          <div className="container max-w-2xl">
            <h1 className="text-2xl font-bold mb-1">{t.rewards_title}</h1>
            <p className="text-white/70 text-sm">{t.rewards_sub}</p>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/20 rounded-full px-4 py-2">
              <Star size={16} className="text-yellow-300" />
              <span className="font-bold">{(customer?.totalPoints ?? 0).toLocaleString()} {t.points_abbr}</span>
            </div>
          </div>
        </div>

        <div className="container max-w-2xl -mt-8 pb-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-[#5B9BD5]" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {rewards?.map((reward, i) => {
                const Icon = REWARD_ICONS[reward.rewardType] ?? Gift;
                const color = REWARD_COLORS[reward.rewardType] ?? "#5B9BD5";
                const canAfford = (customer?.totalPoints ?? 0) >= reward.requiredPoints;

                return (
                  <motion.div
                    key={reward.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${canAfford ? "border-gray-100" : "border-gray-100 opacity-70"}`}
                  >
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center"
                          style={{ backgroundColor: `${color}20` }}
                        >
                          <Icon size={22} style={{ color }} />
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-1 justify-end">
                            <Star size={14} className="text-yellow-400" fill="#FBBF24" />
                            <span className="font-bold text-[#1B2A5E]">{reward.requiredPoints}</span>
                          </div>
                          <span className="text-xs text-gray-400">{t.points_abbr}</span>
                        </div>
                      </div>
                      <h3 className="font-bold text-gray-800 mb-1">{reward.name}</h3>
                      <p className="text-xs text-gray-500 mb-4 leading-relaxed">{reward.description}</p>
                      <button
                        onClick={() => setConfirmReward(reward.id)}
                        disabled={!canAfford || redeemMutation.isPending}
                        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                          canAfford
                            ? "text-white hover:opacity-90 active:scale-95"
                            : "bg-gray-100 text-gray-400 cursor-not-allowed"
                        }`}
                        style={canAfford ? { backgroundColor: color } : {}}
                      >
                        {canAfford ? t.rewards_redeem : `${language === "ar" ? "تحتاج" : "Need"} ${reward.requiredPoints - (customer?.totalPoints ?? 0)} ${language === "ar" ? "نقطة إضافية" : "more pts"}`}
                      </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}

          {/* My Redemptions */}
          {myRedemptions && myRedemptions.length > 0 && (
            <div className="mt-6">
              <h2 className="font-bold text-[#1B2A5E] mb-3">{language === "ar" ? "مكافآتي المستبدلة" : "My Redeemed Rewards"}</h2>
              <div className="space-y-3">
                {myRedemptions.map(({ redemption, reward }) => (
                  <div key={redemption.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
                    <CheckCircle size={20} className="text-green-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-gray-800">{reward?.name}</p>
                      <p className="text-xs text-gray-400">Code: <span className="font-mono font-bold text-[#1B2A5E]">{redemption.couponCode}</span></p>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      redemption.status === "active" ? "bg-green-100 text-green-700" :
                      redemption.status === "used" ? "bg-gray-100 text-gray-500" : "bg-red-100 text-red-500"
                    }`}>
                      {redemption.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Confirm Dialog */}
      <AnimatePresence>
        {confirmReward !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setConfirmReward(null)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="bg-white rounded-2xl p-6 w-full max-w-sm"
              onClick={e => e.stopPropagation()}
            >
              <Gift size={32} className="text-[#5B9BD5] mx-auto mb-3" />
              <h3 className="text-lg font-bold text-center text-[#1B2A5E] mb-2">{language === "ar" ? "تأكيد الاستبدال" : "Confirm Redemption"}</h3>
              <p className="text-gray-500 text-sm text-center mb-6">{language === "ar" ? "هل أنت متأكد من استبدال هذه المكافأة؟ ستُخصم النقاط فوراً." : "Are you sure you want to redeem this reward? Points will be deducted immediately."}</p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmReward(null)} className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold">{t.cancel}</button>
                <button
                  onClick={() => redeemMutation.mutate({ rewardId: confirmReward })}
                  disabled={redeemMutation.isPending}
                  className="flex-1 py-3 rounded-xl bg-[#1B2A5E] text-white font-semibold flex items-center justify-center gap-2"
                >
                  {redeemMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                  Confirm
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CustomerLayout>
  );
}
