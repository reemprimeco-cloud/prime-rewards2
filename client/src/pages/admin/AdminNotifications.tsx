import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { Bell, CheckCircle2, AlertCircle, Gift, Loader2, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function AdminNotifications() {
  const { language, isRTL } = useLanguage();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { data: notifications, isLoading, refetch } = trpc.adminNotifications.list.useQuery(
    { limit: 100, offset: 0 },
    { refetchInterval: 30000 } // Refetch every 30 seconds
  );

  const { data: unreadCount } = trpc.adminNotifications.unreadCount.useQuery(undefined, {
    refetchInterval: 10000,
  });

  const markReadMutation = trpc.adminNotifications.markRead.useMutation({
    onSuccess: () => {
      refetch();
    },
    onError: (err) => {
      toast.error(err.message);
    },
  });

  const handleMarkRead = (notificationId: number) => {
    markReadMutation.mutate({ notificationId });
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "reward_claimed":
        return <Gift className="w-5 h-5 text-green-600" />;
      case "suspicious_activity":
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case "payment_received":
        return <CheckCircle2 className="w-5 h-5 text-blue-600" />;
      default:
        return <Bell className="w-5 h-5 text-gray-600" />;
    }
  };

  const getNotificationColor = (type: string, isRead: boolean) => {
    if (isRead) return "bg-gray-50";
    switch (type) {
      case "reward_claimed":
        return "bg-green-50";
      case "suspicious_activity":
        return "bg-red-50";
      case "payment_received":
        return "bg-blue-50";
      default:
        return "bg-yellow-50";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "reward_claimed":
        return language === "ar" ? "مكافأة مطالب بها" : "Reward Claimed";
      case "suspicious_activity":
        return language === "ar" ? "نشاط مريب" : "Suspicious Activity";
      case "payment_received":
        return language === "ar" ? "تم استقبال الدفع" : "Payment Received";
      case "system_alert":
        return language === "ar" ? "تنبيه النظام" : "System Alert";
      default:
        return type;
    }
  };

  const filteredNotifications = selectedType
    ? notifications?.filter((n) => n.notification.type === selectedType)
    : notifications;

  return (
    <AdminLayout>
      <div className={isRTL ? "md:mr-56" : "md:ml-56"}>
        <div className="prime-gradient text-white px-4 pt-6 pb-12">
          <div className="container max-w-4xl">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold mb-1">
                  {language === "ar" ? "إشعارات الإدارة" : "Admin Notifications"}
                </h1>
                <p className="text-white/70 text-sm">
                  {language === "ar"
                    ? "تابع مطالبات المكافآت والأنشطة المهمة"
                    : "Track reward claims and important activities"}
                </p>
              </div>
              {unreadCount ? (
                <div className="bg-red-500 text-white rounded-full px-4 py-2 font-bold text-lg">
                  {unreadCount}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <div className="container max-w-4xl -mt-8 pb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2 mb-6">
              <button
                onClick={() => setSelectedType(null)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedType === null
                    ? "bg-[#1B2A5E] text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {language === "ar" ? "الكل" : "All"}
              </button>
              <button
                onClick={() => setSelectedType("reward_claimed")}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  selectedType === "reward_claimed"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <Gift size={16} />
                {language === "ar" ? "مكافآت مطالب بها" : "Rewards Claimed"}
              </button>
              <button
                onClick={() => setSelectedType("suspicious_activity")}
                className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                  selectedType === "suspicious_activity"
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                <AlertCircle size={16} />
                {language === "ar" ? "أنشطة مريبة" : "Suspicious"}
              </button>
              <button
                onClick={() => refetch()}
                disabled={isLoading}
                className="ml-auto px-4 py-2 rounded-lg font-medium bg-blue-100 text-blue-700 hover:bg-blue-200 transition-all flex items-center gap-2"
              >
                <RefreshCw size={16} className={isLoading ? "animate-spin" : ""} />
                {language === "ar" ? "تحديث" : "Refresh"}
              </button>
            </div>

            {/* Notifications list */}
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-[#1B2A5E]" />
              </div>
            ) : filteredNotifications && filteredNotifications.length > 0 ? (
              <div className="space-y-3">
                {filteredNotifications.map((item) => (
                  <div
                    key={item.notification.id}
                    className={`p-4 rounded-xl border border-gray-200 transition-all ${getNotificationColor(
                      item.notification.type,
                      item.notification.isRead
                    )}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className="mt-1">{getNotificationIcon(item.notification.type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {item.notification.title}
                          </h3>
                          <span className="text-xs font-medium px-2 py-1 bg-gray-200 text-gray-700 rounded-full whitespace-nowrap">
                            {getTypeLabel(item.notification.type)}
                          </span>
                        </div>
                        <p className="text-sm text-gray-700 mb-2">{item.notification.message}</p>
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span>
                            {new Date(item.notification.createdAt).toLocaleString(
                              language === "ar" ? "ar-KW" : "en-US"
                            )}
                          </span>
                          {!item.notification.isRead && (
                            <button
                              onClick={() => handleMarkRead(item.notification.id)}
                              disabled={markReadMutation.isPending}
                              className="text-blue-600 hover:text-blue-800 font-medium"
                            >
                              {language === "ar" ? "وضع علامة كمقروء" : "Mark as Read"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">
                  {language === "ar" ? "لا توجد إشعارات" : "No notifications"}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
