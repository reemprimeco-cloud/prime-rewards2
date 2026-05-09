import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
import { toast } from "sonner";
import { Gift, Plus, Trash2, Loader2, Tag, Package, Truck, Palette, Zap, Pencil, ToggleLeft, ToggleRight, X, Check } from "lucide-react";

const REWARD_TYPES = [
  { value: "discount", label: "Discount", icon: Tag },
  { value: "free_service", label: "Free Service", icon: Package },
  { value: "merchandise", label: "Merchandise", icon: Gift },
  { value: "free_delivery", label: "Free Delivery", icon: Truck },
  { value: "free_design", label: "Free Design", icon: Palette },
  { value: "double_points", label: "Double Points", icon: Zap },
] as const;

type RewardType = "discount" | "free_service" | "merchandise" | "free_delivery" | "free_design" | "double_points";

interface RewardForm {
  name: string;
  description: string;
  requiredPoints: number;
  rewardType: RewardType;
  rewardValue: number;
  stock: number;
  minTier: "Bronze" | "Silver" | "Gold" | "Platinum";
}

const defaultForm: RewardForm = {
  name: "",
  description: "",
  requiredPoints: 500,
  rewardType: "discount",
  rewardValue: 10,
  stock: -1,
  minTier: "Bronze",
};

export default function AdminRewards() {
  const { data: rewards, isLoading, refetch } = trpc.rewards.list.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<RewardForm>(defaultForm);

  const createMutation = trpc.admin.createReward.useMutation({
    onSuccess: () => {
      toast.success("Reward created!");
      setShowForm(false);
      setForm(defaultForm);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const updateMutation = trpc.admin.updateReward.useMutation({
    onSuccess: () => {
      toast.success("Reward updated!");
      setEditingId(null);
      setForm(defaultForm);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.deleteReward.useMutation({
    onSuccess: () => { toast.success("Reward disabled!"); refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const toggleMutation = trpc.admin.toggleReward.useMutation({
    onSuccess: () => { refetch(); },
    onError: (err) => toast.error(err.message),
  });

  const handleEdit = (reward: NonNullable<typeof rewards>[number]) => {
    setEditingId(reward.id);
    setShowForm(false);
    setForm({
      name: reward.name,
      description: reward.description ?? "",
      requiredPoints: reward.requiredPoints,
      rewardType: reward.rewardType as RewardType,
      rewardValue: reward.discountValue ? parseFloat(reward.discountValue) : 0,
      stock: reward.stock === null ? -1 : reward.stock,
      minTier: "Bronze",
    });
  };

  const handleSubmit = () => {
    if (editingId !== null) {
      updateMutation.mutate({ rewardId: editingId, ...form });
    } else {
      createMutation.mutate(form);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(defaultForm);
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  const RewardFormPanel = () => (
    <div className="bg-white rounded-2xl border border-[#5B9BD5] shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#1B2A5E]">{editingId ? "Edit Reward" : "New Reward"}</h3>
        <button onClick={handleCancel} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-gray-500 mb-1 block font-medium">Name *</label>
          <input
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
            placeholder="e.g. 10% Discount Coupon"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block font-medium">Type *</label>
          <select
            value={form.rewardType}
            onChange={e => setForm(f => ({ ...f, rewardType: e.target.value as RewardType }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
          >
            {REWARD_TYPES.map(t => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="text-xs text-gray-500 mb-1 block font-medium">Description</label>
          <textarea
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5] resize-none"
            placeholder="Describe what the customer receives..."
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block font-medium">Required Points *</label>
          <input
            type="number"
            value={form.requiredPoints}
            onChange={e => setForm(f => ({ ...f, requiredPoints: parseInt(e.target.value) || 0 }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
            min="1"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block font-medium">Reward Value (% or amount)</label>
          <input
            type="number"
            value={form.rewardValue}
            onChange={e => setForm(f => ({ ...f, rewardValue: parseFloat(e.target.value) || 0 }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block font-medium">Stock (-1 = unlimited)</label>
          <input
            type="number"
            value={form.stock}
            onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block font-medium">Minimum Tier</label>
          <select
            value={form.minTier}
            onChange={e => setForm(f => ({ ...f, minTier: e.target.value as "Bronze" | "Silver" | "Gold" | "Platinum" }))}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
          >
            {["Bronze", "Silver", "Gold", "Platinum"].map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex gap-3 mt-4">
        <button onClick={handleCancel} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors">
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={isPending || !form.name}
          className="flex-1 py-2.5 rounded-xl bg-[#1B2A5E] text-white font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50"
        >
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {editingId ? "Save Changes" : "Create Reward"}
        </button>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1B2A5E]">Rewards Store</h2>
            <p className="text-sm text-gray-500">{rewards?.length ?? 0} rewards configured</p>
          </div>
          <button
            onClick={() => { setShowForm(!showForm); setEditingId(null); setForm(defaultForm); }}
            className="flex items-center gap-2 bg-[#1B2A5E] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
          >
            <Plus size={16} />
            Add Reward
          </button>
        </div>

        {(showForm && editingId === null) && <RewardFormPanel />}

        {/* Rewards List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {isLoading ? (
            <div className="col-span-2 flex justify-center py-12">
              <Loader2 size={32} className="animate-spin text-[#5B9BD5]" />
            </div>
          ) : !rewards || rewards.length === 0 ? (
            <div className="col-span-2 text-center py-12 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <Gift size={40} className="mx-auto mb-3 opacity-30" />
              <p>No rewards yet. Add your first reward!</p>
            </div>
          ) : (
            rewards.map(reward => {
              const TypeIcon = REWARD_TYPES.find(t => t.value === reward.rewardType)?.icon ?? Gift;
              const isEditing = editingId === reward.id;
              return (
                <div key={reward.id} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all ${isEditing ? "border-[#5B9BD5]" : "border-gray-100"} ${!reward.isActive ? "opacity-60" : ""}`}>
                  {isEditing ? (
                    <div className="p-5">
                      <RewardFormPanel />
                    </div>
                  ) : (
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${reward.isActive ? "bg-[#EBF4FF]" : "bg-gray-100"}`}>
                            <TypeIcon size={18} className={reward.isActive ? "text-[#1B2A5E]" : "text-gray-400"} />
                          </div>
                          <div>
                            <p className="font-semibold text-gray-800 text-sm">{reward.name}</p>
                            <p className="text-xs text-gray-400 capitalize">{reward.rewardType.replace(/_/g, " ")}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleEdit(reward)}
                            className="p-2 rounded-lg text-[#5B9BD5] hover:bg-[#EBF4FF] transition-colors"
                            title="Edit"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => toggleMutation.mutate({ rewardId: reward.id, isActive: !reward.isActive })}
                            className={`p-2 rounded-lg transition-colors ${reward.isActive ? "text-green-500 hover:bg-green-50" : "text-gray-400 hover:bg-gray-50"}`}
                            title={reward.isActive ? "Disable" : "Enable"}
                          >
                            {reward.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                          <button
                            onClick={() => deleteMutation.mutate({ rewardId: reward.id })}
                            className="p-2 rounded-lg text-red-400 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-gray-500 mb-3 leading-relaxed">{reward.description}</p>
                      <div className="flex items-center justify-between text-xs bg-gray-50 rounded-xl px-3 py-2">
                        <span className="font-bold text-[#1B2A5E]">{reward.requiredPoints.toLocaleString()} pts</span>
                        {reward.discountValue && <span className="text-gray-500">Value: {reward.discountValue}%</span>}
                        <span className="text-gray-400">Stock: {reward.stock === null ? "∞" : reward.stock}</span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${reward.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {reward.isActive ? "Active" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
