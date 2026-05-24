import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import { User, Copy, Award, Edit2, Check, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

const BADGE_COLORS: Record<string, string> = {
  "First Order": "#F59E0B",
  "Loyal Customer": "#EC4899",
  "Big Spender": "#F97316",
  "5 Orders Completed": "#10B981",
  "VIP Customer": "#9C27B0",
  "UV DTF Expert": "#2196F3",
  "Top Customer": "#1B2A5E",
};

const TIER_COLORS: Record<string, string> = {
  Bronze: "#CD7F32", Silver: "#94A3B8", Gold: "#F59E0B", Platinum: "#6366F1",
};

const TIER_NAMES_AR: Record<string, string> = {
  Bronze: "برونز", Silver: "فضي", Gold: "ذهبي", Platinum: "بلاتيني",
};

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const { t, language, isRTL } = useLanguage();
  const { data: customer, refetch } = trpc.customer.me.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myBadges } = trpc.badges.mine.useQuery(undefined, { enabled: isAuthenticated });
  const { data: allBadges } = trpc.badges.all.useQuery();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", businessName: "" });
  const [phoneError, setPhoneError] = useState("");

  // Kuwait phone validation: +965 followed by 8 digits starting with 5, 6, 9, 2, or 1
  const validateKuwaitPhone = (phone: string): string => {
    if (!phone) return "";
    const cleaned = phone.replace(/\s|-/g, "");
    const kuwaitRegex = /^(\+965|00965|965)?[5692][0-9]{7}$/;
    if (!kuwaitRegex.test(cleaned)) {
      return language === "ar"
        ? "رقم الهاتف غير صحيح. يجب أن يكون رقماً كويتياً صحيحاً (مثال: +965 9999 9999)"
        : "Invalid phone number. Must be a valid Kuwait number (e.g. +965 9999 9999)";
    }
    return "";
  };

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => {
      toast.success(language === "ar" ? "تم تحديث الملف الشخصي!" : "Profile updated!");
      setEditing(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const startEdit = () => {
    setForm({
      fullName: customer?.fullName ?? "",
      phone: customer?.phone ?? "",
      businessName: customer?.businessName ?? "",
    });
    setEditing(true);
  };

  const copyReferral = () => {
    if (customer?.referralCode) {
      navigator.clipboard.writeText(customer.referralCode);
      toast.success(t.referral_copied);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-[#1B2A5E] mb-4">
            {language === "ar" ? "سجّل دخولك لعرض ملفك الشخصي" : "Sign in to view your profile"}
          </h2>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">{t.login}</a>
        </div>
      </div>
    );
  }

  const earnedBadgeIds = new Set(myBadges?.map(b => b.badge?.id) ?? []);
  const tier = customer?.tier ?? "Bronze";
  const tierColor = TIER_COLORS[tier];
  const tierDisplay = language === "ar" ? (TIER_NAMES_AR[tier] ?? tier) : tier;

  return (
    <CustomerLayout>
      <div className={isRTL ? "md:mr-56" : "md:ml-56"}>
        {/* Header */}
        <div className="prime-gradient text-white px-4 pt-6 pb-16">
          <div className="container max-w-lg text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
              <User size={36} className="text-white" />
            </div>
            <h1 className="text-xl font-bold">{customer?.fullName ?? user?.name}</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Award size={16} style={{ color: tierColor }} />
              <span className="text-sm font-semibold text-white/90">
                {tierDisplay} {language === "ar" ? "عضو" : "Member"}
              </span>
            </div>
          </div>
        </div>

        <div className="container max-w-lg -mt-10 pb-6 space-y-4">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">{t.profile_title}</h3>
              <button
                onClick={editing ? () => setEditing(false) : startEdit}
                className="flex items-center gap-1.5 text-sm text-[#5B9BD5] font-medium"
              >
                <Edit2 size={14} />
                {editing ? t.profile_cancel : t.profile_edit}
              </button>
            </div>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{t.profile_name}</label>
                  <input
                    value={form.fullName}
                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{t.profile_phone}</label>
                  <input
                    value={form.phone}
                    onChange={e => {
                      setForm(f => ({ ...f, phone: e.target.value }));
                      setPhoneError(validateKuwaitPhone(e.target.value));
                    }}
                    className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-colors ${
                      phoneError ? "border-red-400 focus:border-red-400" : "border-gray-200 focus:border-[#5B9BD5]"
                    }`}
                    placeholder={language === "ar" ? "+965 XXXX XXXX" : "+965 XXXX XXXX"}
                    dir="ltr"
                  />
                  {phoneError && (
                    <p className="text-xs text-red-500 mt-1">{phoneError}</p>
                  )}
                  {form.phone && !phoneError && (
                    <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                      <Check size={12} />
                      {language === "ar" ? "رقم هاتف صحيح" : "Valid Kuwait number"}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">
                    {language === "ar" ? "اسم الشركة" : "Business Name"}
                  </label>
                  <input
                    value={form.businessName}
                    onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
                    placeholder={language === "ar" ? "اسم شركتك" : "Your business name"}
                  />
                </div>
                <button
                  onClick={() => {
                    const err = validateKuwaitPhone(form.phone);
                    if (err) { setPhoneError(err); return; }
                    updateMutation.mutate(form);
                  }}
                  disabled={updateMutation.isPending || !!phoneError}
                  className="w-full bg-[#1B2A5E] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  {t.profile_save}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: t.profile_name, value: customer?.fullName },
                  { label: t.profile_email, value: user?.email },
                  { label: t.profile_phone, value: customer?.phone || "—" },
                  { label: language === "ar" ? "الشركة" : "Business", value: customer?.businessName || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-medium text-gray-800 dir-ltr">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Points Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-[#1B2A5E]">{customer?.totalPoints ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">{t.dash_points_balance}</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-[#5B9BD5]">{customer?.lifetimePoints ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">{t.dash_lifetime_points}</div>
            </div>
          </div>

          {/* Referral Code */}
          <div className="bg-[#EBF4FF] rounded-2xl border border-[#5B9BD5]/20 p-5">
            <h3 className="font-semibold text-[#1B2A5E] mb-2">{t.referral_your_code}</h3>
            <p className="text-xs text-gray-500 mb-3">
              {language === "ar"
                ? "شارك هذا الكود مع أصدقائك لكسب نقاط إضافية عند انضمامهم."
                : "Share this code with friends to earn bonus points when they join."}
            </p>
            <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#5B9BD5]/30">
              <span className="font-mono font-bold text-[#1B2A5E] text-lg flex-1 tracking-wider" dir="ltr">
                {customer?.referralCode ?? "—"}
              </span>
              <button onClick={copyReferral} className="p-2 rounded-lg bg-[#5B9BD5] text-white hover:opacity-90">
                <Copy size={16} />
              </button>
            </div>
          </div>

          {/* Achievement Badges */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">{t.profile_badges_title}</h3>
            {!allBadges || allBadges.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">{t.profile_no_badges}</p>
            ) : (
              <div className="grid grid-cols-3 gap-3">
                {allBadges.map((badge, i) => {
                  const earned = earnedBadgeIds.has(badge.id);
                  const color = BADGE_COLORS[badge.name] ?? "#5B9BD5";
                  return (
                    <motion.div
                      key={badge.id}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.05 }}
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl text-center ${earned ? "bg-white border border-gray-100 shadow-sm" : "bg-gray-50 opacity-50"}`}
                    >
                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center"
                        style={{ backgroundColor: earned ? `${color}20` : "#f3f4f6" }}
                      >
                        <Award size={22} style={{ color: earned ? color : "#9CA3AF" }} />
                      </div>
                      <span className="text-xs font-semibold text-gray-700 leading-tight">{badge.name}</span>
                      {earned && (
                        <span className="text-[10px] text-green-600 font-medium">
                          {language === "ar" ? "مكتسبة!" : "Earned!"}
                        </span>
                      )}
                    </motion.div>
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
