import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { motion } from "framer-motion";
import { User, Copy, Award, Star, Edit2, Check, Loader2 } from "lucide-react";
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
  Bronze: "#CD7F32",
  Silver: "#94A3B8",
  Gold: "#F59E0B",
  Platinum: "#6366F1",
};

export default function Profile() {
  const { user, isAuthenticated } = useAuth();
  const { data: customer, refetch } = trpc.customer.me.useQuery(undefined, { enabled: isAuthenticated });
  const { data: myBadges } = trpc.badges.mine.useQuery(undefined, { enabled: isAuthenticated });
  const { data: allBadges } = trpc.badges.all.useQuery();

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: "", phone: "", businessName: "" });

  const updateMutation = trpc.customer.update.useMutation({
    onSuccess: () => {
      toast.success("Profile updated!");
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
      toast.success("Referral code copied!");
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-[#1B2A5E] mb-4">Sign in to view your profile</h2>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">Sign In</a>
        </div>
      </div>
    );
  }

  const earnedBadgeIds = new Set(myBadges?.map(b => b.badge?.id) ?? []);
  const tierColor = TIER_COLORS[customer?.tier ?? "Bronze"];

  return (
    <CustomerLayout>
      <div className="md:ml-56">
        {/* Header */}
        <div className="prime-gradient text-white px-4 pt-6 pb-16">
          <div className="container max-w-lg text-center">
            <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
              <User size={36} className="text-white" />
            </div>
            <h1 className="text-xl font-bold">{customer?.fullName ?? user?.name}</h1>
            <div className="flex items-center justify-center gap-2 mt-2">
              <Award size={16} style={{ color: tierColor }} />
              <span className="text-sm font-semibold" style={{ color: tierColor === "#CD7F32" ? "#FFD700" : tierColor }}>
                {customer?.tier ?? "Bronze"} Member
              </span>
            </div>
          </div>
        </div>

        <div className="container max-w-lg -mt-10 pb-6 space-y-4">
          {/* Profile Card */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-800">Profile Info</h3>
              <button
                onClick={editing ? () => setEditing(false) : startEdit}
                className="flex items-center gap-1.5 text-sm text-[#5B9BD5] font-medium"
              >
                <Edit2 size={14} />
                {editing ? "Cancel" : "Edit"}
              </button>
            </div>

            {editing ? (
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Full Name</label>
                  <input
                    value={form.fullName}
                    onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Phone</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
                    placeholder="+971 XX XXX XXXX"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Business Name</label>
                  <input
                    value={form.businessName}
                    onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
                    placeholder="Your business name"
                  />
                </div>
                <button
                  onClick={() => updateMutation.mutate(form)}
                  disabled={updateMutation.isPending}
                  className="w-full bg-[#1B2A5E] text-white py-3 rounded-xl font-semibold flex items-center justify-center gap-2"
                >
                  {updateMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
                  Save Changes
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Full Name", value: customer?.fullName },
                  { label: "Email", value: user?.email },
                  { label: "Phone", value: customer?.phone || "—" },
                  { label: "Business", value: customer?.businessName || "—" },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-medium text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Points Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-[#1B2A5E]">{customer?.totalPoints ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Available Points</div>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="text-2xl font-bold text-[#5B9BD5]">{customer?.lifetimePoints ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Lifetime Points</div>
            </div>
          </div>

          {/* Referral Code */}
          <div className="bg-[#EBF4FF] rounded-2xl border border-[#5B9BD5]/20 p-5">
            <h3 className="font-semibold text-[#1B2A5E] mb-2">Your Referral Code</h3>
            <p className="text-xs text-gray-500 mb-3">Share this code with friends to earn bonus points when they join.</p>
            <div className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-[#5B9BD5]/30">
              <span className="font-mono font-bold text-[#1B2A5E] text-lg flex-1 tracking-wider">
                {customer?.referralCode ?? "—"}
              </span>
              <button onClick={copyReferral} className="p-2 rounded-lg bg-[#5B9BD5] text-white hover:opacity-90">
                <Copy size={16} />
              </button>
            </div>
          </div>

          {/* Achievement Badges */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-800 mb-4">Achievement Badges</h3>
            {!allBadges || allBadges.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No badges available yet.</p>
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
                        <span className="text-[10px] text-green-600 font-medium">Earned!</span>
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
