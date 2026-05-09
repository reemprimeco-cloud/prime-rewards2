import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useState } from "react";
import { toast } from "sonner";
import { Megaphone, Plus, Trash2, Loader2, Calendar, Zap, CheckCircle, Clock } from "lucide-react";
import { format } from "date-fns";

export default function AdminCampaigns() {
  const { data: campaigns, isLoading, refetch } = trpc.campaigns.all.useQuery();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    multiplier: 2,
    bonusPoints: 0,
    startDate: "",
    endDate: "",
  });

  const createMutation = trpc.admin.createCampaign.useMutation({
    onSuccess: () => {
      toast.success("Campaign created!");
      setShowForm(false);
      setForm({ name: "", description: "", multiplier: 2, bonusPoints: 0, startDate: "", endDate: "" });
      refetch();
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const deleteMutation = trpc.admin.deleteCampaign.useMutation({
    onSuccess: () => { toast.success("Campaign deactivated!"); refetch(); },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const now = new Date();
  const activeCampaigns = campaigns?.filter(c => c.isActive && new Date(c.endDate) > now) ?? [];
  const pastCampaigns = campaigns?.filter(c => !c.isActive || new Date(c.endDate) <= now) ?? [];

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#1B2A5E]">Campaigns & Promotions</h2>
            <p className="text-sm text-gray-500">{activeCampaigns.length} active campaigns</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-[#1B2A5E] text-white px-4 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
          >
            <Plus size={16} />
            New Campaign
          </button>
        </div>

        {/* Create Form */}
        {showForm && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-[#1B2A5E] mb-4">New Campaign</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Campaign Name *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
                  placeholder="e.g. Ramadan Double Points"
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs text-gray-500 mb-1 block">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5] resize-none"
                  placeholder="Describe the campaign..."
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Points Multiplier (e.g. 2 = 2x points)</label>
                <input
                  type="number"
                  value={form.multiplier}
                  onChange={e => setForm(f => ({ ...f, multiplier: parseFloat(e.target.value) || 1 }))}
                  min="1"
                  max="10"
                  step="0.5"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Bonus Points (flat bonus per invoice)</label>
                <input
                  type="number"
                  value={form.bonusPoints}
                  onChange={e => setForm(f => ({ ...f, bonusPoints: parseInt(e.target.value) || 0 }))}
                  min="0"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Start Date *</label>
                <input
                  type="datetime-local"
                  value={form.startDate}
                  onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">End Date *</label>
                <input
                  type="datetime-local"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm">Cancel</button>
              <button
                onClick={() => {
                  if (!form.name || !form.startDate || !form.endDate) {
                    toast.error("Please fill in all required fields");
                    return;
                  }
                  createMutation.mutate({
                    name: form.name,
                    description: form.description || undefined,
                    multiplier: form.multiplier,
                    bonusPoints: form.bonusPoints || undefined,
                    startDate: new Date(form.startDate),
                    endDate: new Date(form.endDate),
                  });
                }}
                disabled={createMutation.isPending}
                className="flex-1 py-2.5 rounded-xl bg-[#1B2A5E] text-white font-semibold text-sm flex items-center justify-center gap-2"
              >
                {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
                Create Campaign
              </button>
            </div>
          </div>
        )}

        {/* Active Campaigns */}
        <div>
          <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <CheckCircle size={16} className="text-green-500" />
            Active Campaigns ({activeCampaigns.length})
          </h3>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 size={28} className="animate-spin text-[#5B9BD5]" /></div>
          ) : activeCampaigns.length === 0 ? (
            <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center text-gray-400">
              <Megaphone size={36} className="mx-auto mb-2 opacity-30" />
              <p>No active campaigns. Create one to boost customer engagement!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeCampaigns.map(campaign => (
                <div key={campaign.id} className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center">
                        <Zap size={18} className="text-green-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-gray-800">{campaign.name}</p>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
                      </div>
                    </div>
                    <button
                      onClick={() => deleteMutation.mutate({ campaignId: campaign.id })}
                      className="p-2 rounded-lg text-red-400 hover:bg-red-50"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  {campaign.description && <p className="text-xs text-gray-500 mb-3">{campaign.description}</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400">Multiplier</span>
                      <p className="font-bold text-[#1B2A5E]">{campaign.multiplier}x</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-2">
                      <span className="text-gray-400">Bonus Points</span>
                      <p className="font-bold text-[#5B9BD5]">+{campaign.bonusPoints ?? 0}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-3 text-xs text-gray-400">
                    <Calendar size={12} />
                    {format(new Date(campaign.startDate), "MMM d")} – {format(new Date(campaign.endDate), "MMM d, yyyy")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Past Campaigns */}
        {pastCampaigns.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              <Clock size={16} className="text-gray-400" />
              Past Campaigns ({pastCampaigns.length})
            </h3>
            <div className="space-y-2">
              {pastCampaigns.map(campaign => (
                <div key={campaign.id} className="bg-white rounded-xl border border-gray-100 px-5 py-3 flex items-center gap-3 opacity-60">
                  <Megaphone size={16} className="text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-700">{campaign.name}</p>
                    <p className="text-xs text-gray-400">{format(new Date(campaign.startDate), "MMM d")} – {format(new Date(campaign.endDate), "MMM d, yyyy")}</p>
                  </div>
                  <span className="text-xs text-gray-400">{campaign.multiplier}x</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
