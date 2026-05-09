import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell, CheckCheck, Loader2, Gift, Star, AlertTriangle, Zap, Trophy } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const TYPE_CONFIG: Record<string, { icon: typeof Bell; color: string; bg: string }> = {
  points_added: { icon: Star, color: "text-[#5B9BD5]", bg: "bg-[#EBF4FF]" },
  points_expiring: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-50" },
  points_expired: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50" },
  tier_upgrade: { icon: Trophy, color: "text-yellow-600", bg: "bg-yellow-50" },
  badge_earned: { icon: Trophy, color: "text-purple-500", bg: "bg-purple-50" },
  reward_redeemed: { icon: Gift, color: "text-green-500", bg: "bg-green-50" },
  spin_result: { icon: Zap, color: "text-[#1B2A5E]", bg: "bg-[#EBF4FF]" },
  campaign_active: { icon: Zap, color: "text-orange-500", bg: "bg-orange-50" },
  invoice_approved: { icon: CheckCheck, color: "text-green-500", bg: "bg-green-50" },
  invoice_rejected: { icon: AlertTriangle, color: "text-red-500", bg: "bg-red-50" },
};

export default function Notifications() {
  const { t, language, isRTL } = useLanguage();
  const { data: notifications, isLoading, refetch } = trpc.notifications.list.useQuery();
  const utils = trpc.useUtils();

  const markReadMutation = trpc.notifications.markRead.useMutation({
    onSuccess: () => {
      refetch();
      utils.notifications.unreadCount.invalidate();
      toast.success(language === "ar" ? "تم تحديد جميع الإشعارات كمقروءة" : "All notifications marked as read");
    },
  });

  const unread = notifications?.filter(n => !n.isRead).length ?? 0;

  return (
    <CustomerLayout>
      <div className={`max-w-2xl mx-auto px-4 py-6 ${isRTL ? "md:mr-56" : "md:ml-56"}`}>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-[#1B2A5E]">{t.notif_title}</h1>
            {unread > 0 && (
              <p className="text-sm text-gray-500">{unread} {language === "ar" ? "غير مقروء" : "unread"}</p>
            )}
          </div>
          {unread > 0 && (
            <button
              onClick={() => markReadMutation.mutate()}
              disabled={markReadMutation.isPending}
              className="flex items-center gap-2 text-sm text-[#5B9BD5] font-semibold hover:opacity-80"
            >
              <CheckCheck size={16} />
              {t.notif_mark_read}
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-[#5B9BD5]" />
          </div>
        ) : !notifications || notifications.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <Bell size={48} className="mx-auto mb-4 text-gray-200" />
            <h3 className="font-semibold text-gray-500 mb-1">{t.notif_empty}</h3>
            <p className="text-sm text-gray-400">{language === "ar" ? "سنخبرك عند حدوث أي تغيير في حسابك." : "We'll let you know when something happens with your account."}</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            {notifications.map((notification, index) => {
              const cfg = TYPE_CONFIG[notification.type] ?? { icon: Bell, color: "text-gray-500", bg: "bg-gray-50" };
              const Icon = cfg.icon;
              return (
                <div
                  key={notification.id}
                  className={`px-5 py-4 flex items-start gap-4 ${
                    index < notifications.length - 1 ? "border-b border-gray-50" : ""
                  } ${!notification.isRead ? "bg-[#EBF4FF]/30" : ""}`}
                >
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon size={18} className={cfg.color} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`font-semibold text-sm ${!notification.isRead ? "text-[#1B2A5E]" : "text-gray-700"}`}>
                        {notification.title}
                      </p>
                      {!notification.isRead && (
                        <span className="w-2 h-2 rounded-full bg-[#5B9BD5] flex-shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-sm text-gray-500 mt-0.5 leading-relaxed">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {format(new Date(notification.createdAt), "MMM d, yyyy · h:mm a")}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
