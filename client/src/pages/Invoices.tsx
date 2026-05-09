import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { motion } from "framer-motion";
import { FileText, Plus, Clock, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getLoginUrl } from "@/const";

const STATUS_CONFIG = {
  pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", label: "Pending Review" },
  approved: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: "Approved" },
  rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: "Rejected" },
  flagged: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: "Flagged" },
};

export default function Invoices() {
  const { isAuthenticated } = useAuth();
  const { data: myInvoices, isLoading, refetch } = trpc.invoices.myInvoices.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );
  const utils = trpc.useUtils();

  const [showForm, setShowForm] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");

  const submitMutation = trpc.invoices.submit.useMutation({
    onSuccess: () => {
      toast.success("Invoice submitted! It will be reviewed shortly.");
      setInvoiceNumber("");
      setInvoiceAmount("");
      setShowForm(false);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || !invoiceAmount) return;
    submitMutation.mutate({
      invoiceNumber: invoiceNumber.trim(),
      invoiceAmount: parseFloat(invoiceAmount),
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-[#1B2A5E] mb-4">Sign in to submit invoices</h2>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">Sign In</a>
        </div>
      </div>
    );
  }

  return (
    <CustomerLayout>
      <div className="md:ml-56">
        <div className="prime-gradient text-white px-4 pt-6 pb-12">
          <div className="container max-w-lg flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">My Invoices</h1>
              <p className="text-white/70 text-sm">Submit invoices to earn points</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-white text-[#1B2A5E] px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors"
            >
              <Plus size={16} />
              Submit
            </button>
          </div>
        </div>

        <div className="container max-w-lg -mt-8 pb-6 space-y-4">
          {/* Submit Form */}
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
            >
              <h3 className="font-semibold text-[#1B2A5E] mb-4">Submit New Invoice</h3>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 mb-1.5 block font-medium">Invoice Number *</label>
                  <input
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2024-001"
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#5B9BD5] focus:ring-1 focus:ring-[#5B9BD5]"
                  />
                </div>
                <div>
                  <label className="text-sm text-gray-600 mb-1.5 block font-medium">Invoice Amount (AED) *</label>
                  <input
                    type="number"
                    value={invoiceAmount}
                    onChange={e => setInvoiceAmount(e.target.value)}
                    placeholder="e.g. 500"
                    min="1"
                    step="0.01"
                    required
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#5B9BD5] focus:ring-1 focus:ring-[#5B9BD5]"
                  />
                  {invoiceAmount && parseFloat(invoiceAmount) > 0 && (
                    <p className="text-xs text-[#5B9BD5] mt-1.5">
                      You'll earn approximately {Math.floor(parseFloat(invoiceAmount) / 10)} points
                    </p>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitMutation.isPending}
                    className="flex-1 py-3 rounded-xl bg-[#1B2A5E] text-white font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    {submitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                    Submit Invoice
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Info Banner */}
          <div className="bg-[#EBF4FF] rounded-xl p-4 flex gap-3">
            <FileText size={18} className="text-[#5B9BD5] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#1B2A5E]">How it works</p>
              <p className="text-xs text-gray-500 mt-0.5">Submit your PRIME Printing Co. invoice number and amount. Our team will review and approve it within 24 hours. You earn 1 point per 10 AED spent.</p>
            </div>
          </div>

          {/* Invoice List */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 size={32} className="animate-spin text-[#5B9BD5]" />
              </div>
            ) : !myInvoices || myInvoices.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <FileText size={40} className="mx-auto mb-3 opacity-30" />
                <p className="font-medium">No invoices yet</p>
                <p className="text-sm mt-1">Submit your first invoice to start earning points!</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center gap-2 bg-[#1B2A5E] text-white px-6 py-2.5 rounded-xl font-semibold text-sm"
                >
                  <Plus size={16} />
                  Submit Invoice
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {myInvoices.map((inv) => {
                  const status = STATUS_CONFIG[inv.status] ?? STATUS_CONFIG.pending;
                  const StatusIcon = status.icon;
                  return (
                    <div key={inv.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm">#{inv.invoiceNumber}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{format(new Date(inv.submittedAt), "MMM d, yyyy · h:mm a")}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-[#1B2A5E] text-sm">{parseFloat(String(inv.invoiceAmount)).toLocaleString()} AED</p>
                          {inv.status === "approved" && (
                            <p className="text-xs text-green-600 font-medium">+{inv.pointsEarned} pts</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </div>
                        {inv.multiplierApplied > 1 && (
                          <span className="text-xs bg-[#EBF4FF] text-[#5B9BD5] px-2 py-1 rounded-full font-medium">
                            {inv.multiplierApplied}x bonus
                          </span>
                        )}
                      </div>
                      {inv.rejectionReason && (
                        <p className="text-xs text-red-400 mt-2 bg-red-50 px-3 py-2 rounded-lg">{inv.rejectionReason}</p>
                      )}
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
