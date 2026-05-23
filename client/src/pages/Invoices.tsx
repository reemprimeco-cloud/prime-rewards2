import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  Search, CheckCircle, AlertCircle, Loader2, FileText,
  Phone, Hash, ChevronRight, Star, ArrowLeft, Shield
} from "lucide-react";

type LookupInvoice = {
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  status: string;
  date: string;
};

type LookupMode = "invoice" | "phone";

export default function Invoices() {
  const { t, isRTL } = useLanguage();

  const [mode, setMode] = useState<LookupMode>("invoice");
  const [query, setQuery] = useState("");
  const [lookupResult, setLookupResult] = useState<{
    found: boolean;
    reason: string;
    message: string;
    invoices: LookupInvoice[];
  } | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<LookupInvoice | null>(null);
  const [manualAmount, setManualAmount] = useState("");
  const [step, setStep] = useState<"search" | "select" | "confirm" | "success">("search");
  const [earnedPoints, setEarnedPoints] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const qbStatusQuery = trpc.invoices.qbStatus.useQuery();
  const qbConnected = qbStatusQuery.data?.connected ?? false;

  const lookupMutation = trpc.invoices.lookup.useMutation({
    onSuccess: (data: { found: boolean; reason: string; message: string; invoices: LookupInvoice[] }) => {
      setLookupResult(data);
      if (data.found && data.invoices.length === 1) {
        setSelectedInvoice(data.invoices[0]);
        setStep("confirm");
      } else if (data.found && data.invoices.length > 1) {
        setStep("select");
      }
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const submitMutation = trpc.invoices.submit.useMutation({
    onSuccess: (data: { pointsEarned?: number }) => {
      setEarnedPoints(data.pointsEarned ?? 0);
      setStep("success");
      toast.success(`Invoice submitted! You earned ${data.pointsEarned ?? 0} points.`);
    },
    onError: (err: { message: string }) => toast.error(err.message),
  });

  const handleSearch = () => {
    if (!query.trim()) return;
    setLookupResult(null);
    setSelectedInvoice(null);
    lookupMutation.mutate({ query: query.trim(), type: mode });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSearch();
  };

  const handleSelectInvoice = (inv: LookupInvoice) => {
    setSelectedInvoice(inv);
    setStep("confirm");
  };

  const handleConfirmSubmit = () => {
    if (!selectedInvoice) return;
    const amount = selectedInvoice.totalAmount > 0
      ? selectedInvoice.totalAmount
      : parseFloat(manualAmount);
    if (!amount || amount <= 0) {
      toast.error("Please enter the invoice amount.");
      return;
    }
    submitMutation.mutate({
      invoiceNumber: selectedInvoice.invoiceNumber,
      invoiceAmount: amount,
    });
  };

  const handleReset = () => {
    setQuery("");
    setLookupResult(null);
    setSelectedInvoice(null);
    setManualAmount("");
    setStep("search");
    setEarnedPoints(0);
  };

  const pointsPreview = selectedInvoice?.totalAmount
    ? Math.floor(selectedInvoice.totalAmount / 10)
    : manualAmount
      ? Math.floor(parseFloat(manualAmount) / 10)
      : 0;

  const statusColor = (status: string) => {
    if (status === "paid") return "text-green-600 bg-green-50";
    if (status === "partial") return "text-amber-600 bg-amber-50";
    return "text-red-600 bg-red-50";
  };

  const statusLabel = (status: string) => {
    if (status === "paid") return "Paid ✓";
    if (status === "partial") return "Partially Paid";
    return "Unpaid";
  };

  return (
    <CustomerLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          {step !== "search" && (
            <button onClick={handleReset} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
              <ArrowLeft size={18} className="text-[#1B2A5E]" />
            </button>
          )}
          <div>
            <h2 className="text-xl font-bold text-[#1B2A5E]">Submit Invoice</h2>
            <p className="text-sm text-gray-500">Earn points from your PRIME Printing Co. invoices</p>
          </div>
        </div>

        {/* QB Status Badge */}
        <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
          qbConnected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
        }`}>
          <Shield size={12} />
          {qbConnected ? "QuickBooks Connected — Auto-verified" : "Manual Review Mode"}
        </div>

        {/* ── STEP: SEARCH ── */}
        {step === "search" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">

            {/* Mode Toggle */}
            <div className="flex gap-2 p-1 bg-gray-100 rounded-xl">
              {(["invoice", "phone"] as LookupMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setQuery(""); setLookupResult(null); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                    mode === m ? "bg-white text-[#1B2A5E] shadow-sm" : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {m === "invoice" ? <Hash size={14} /> : <Phone size={14} />}
                  {m === "invoice" ? "Invoice No." : "Phone Number"}
                </button>
              ))}
            </div>

            {/* Search Input */}
            <div>
              <label className="text-sm font-semibold text-[#1B2A5E] mb-2 block">
                {mode === "invoice" ? "Enter Invoice Number" : "Enter Phone Number"}
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={mode === "invoice" ? "e.g. 1038" : "e.g. +96512345678"}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#5B9BD5] focus:ring-2 focus:ring-[#5B9BD5]/20 pr-10"
                    dir={mode === "phone" ? "ltr" : undefined}
                  />
                  {lookupMutation.isPending && (
                    <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400" />
                  )}
                </div>
                <button
                  onClick={handleSearch}
                  disabled={!query.trim() || lookupMutation.isPending}
                  className="px-5 py-3 bg-[#1B2A5E] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center gap-2 transition-opacity"
                >
                  <Search size={16} />
                  Search
                </button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {mode === "invoice"
                  ? "Enter the invoice number from your PRIME Printing Co. invoice"
                  : "Enter the phone number registered with PRIME Printing Co."}
              </p>
            </div>

            {/* Lookup Error */}
            {lookupResult && !lookupResult.found && (
              <div className="flex items-start gap-3 p-4 bg-red-50 rounded-xl border border-red-100">
                <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Not Found</p>
                  <p className="text-xs text-red-600 mt-0.5">{lookupResult.message}</p>
                  {lookupResult.reason === "QB_NOT_CONNECTED" && (
                    <p className="text-xs text-gray-500 mt-2">
                      You can still submit manually — enter the invoice number and amount below.
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Manual fallback when QB not connected */}
            {lookupResult?.reason === "QB_NOT_CONNECTED" && (
              <div className="space-y-3 pt-2 border-t border-gray-100">
                <p className="text-sm font-semibold text-[#1B2A5E]">Manual Submission</p>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">Invoice Amount (KD)</label>
                  <input
                    type="number"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    placeholder="e.g. 150.000"
                    step="0.001"
                    min="0"
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#5B9BD5]"
                  />
                </div>
                {manualAmount && parseFloat(manualAmount) > 0 && (
                  <div className="flex items-center gap-2 p-3 bg-[#EBF4FF] rounded-xl">
                    <Star size={14} className="text-[#5B9BD5]" />
                    <p className="text-sm text-[#1B2A5E]">
                      You will earn <span className="font-bold">{Math.floor(parseFloat(manualAmount) / 10)} points</span>
                    </p>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (!query.trim() || !manualAmount || parseFloat(manualAmount) <= 0) {
                      toast.error("Please enter both invoice number and amount.");
                      return;
                    }
                    setSelectedInvoice({
                      invoiceNumber: query.trim(),
                      customerName: "",
                      totalAmount: parseFloat(manualAmount),
                      status: "manual",
                      date: new Date().toISOString().split("T")[0],
                    });
                    setStep("confirm");
                  }}
                  className="w-full py-3 bg-[#1B2A5E] text-white rounded-xl text-sm font-semibold hover:opacity-90"
                >
                  Continue to Submit
                </button>
              </div>
            )}

            {/* How it works */}
            <div className="p-4 bg-[#F0F7FF] rounded-xl">
              <p className="text-xs font-semibold text-[#1B2A5E] mb-2">How it works</p>
              <div className="space-y-1.5">
                {[
                  "Enter your invoice number or phone number",
                  "System finds your invoice and amount automatically",
                  "Earn 1 point for every 10 KD spent",
                  "Redeem points for discounts and free services",
                ].map((step, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                    <div className="w-4 h-4 rounded-full bg-[#1B2A5E] text-white flex items-center justify-center text-[10px] font-bold flex-shrink-0">{i + 1}</div>
                    {step}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP: SELECT (multiple invoices from phone lookup) ── */}
        {step === "select" && lookupResult && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="font-bold text-[#1B2A5E]">Select Invoice</h3>
              <p className="text-sm text-gray-500">{lookupResult.message}</p>
            </div>
            <div className="space-y-3">
              {lookupResult.invoices.map((inv) => (
                <button
                  key={inv.invoiceNumber}
                  onClick={() => handleSelectInvoice(inv)}
                  className="w-full text-left p-4 border border-gray-200 rounded-xl hover:border-[#5B9BD5] hover:bg-[#F0F7FF] transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <FileText size={14} className="text-[#5B9BD5]" />
                        <span className="font-semibold text-[#1B2A5E] text-sm">Invoice #{inv.invoiceNumber}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(inv.status)}`}>
                          {statusLabel(inv.status)}
                        </span>
                      </div>
                      {inv.customerName && (
                        <p className="text-xs text-gray-500">{inv.customerName}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{inv.date}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-[#1B2A5E]">{inv.totalAmount.toFixed(3)} KD</p>
                      <p className="text-xs text-[#5B9BD5]">{Math.floor(inv.totalAmount / 10)} pts</p>
                      <ChevronRight size={16} className="text-gray-400 group-hover:text-[#5B9BD5] mt-1 ml-auto" />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP: CONFIRM ── */}
        {step === "confirm" && selectedInvoice && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
            <div>
              <h3 className="font-bold text-[#1B2A5E]">Confirm Submission</h3>
              <p className="text-sm text-gray-500">Review the invoice details before earning your points</p>
            </div>

            {/* Invoice Card */}
            <div className="bg-[#F0F7FF] rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-[#5B9BD5]" />
                <span className="font-bold text-[#1B2A5E]">Invoice #{selectedInvoice.invoiceNumber}</span>
                {selectedInvoice.status !== "manual" && (
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColor(selectedInvoice.status)}`}>
                    {statusLabel(selectedInvoice.status)}
                  </span>
                )}
              </div>
              {selectedInvoice.customerName && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-semibold text-[#1B2A5E]">{selectedInvoice.customerName}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Amount</span>
                <span className="font-bold text-[#1B2A5E] text-lg">
                  {selectedInvoice.totalAmount > 0
                    ? `${selectedInvoice.totalAmount.toFixed(3)} KD`
                    : "—"}
                </span>
              </div>
              {selectedInvoice.date && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Date</span>
                  <span className="text-[#1B2A5E]">{selectedInvoice.date}</span>
                </div>
              )}
            </div>

            {/* Manual amount if QB not connected */}
            {selectedInvoice.totalAmount === 0 && (
              <div>
                <label className="text-sm font-semibold text-[#1B2A5E] mb-2 block">Invoice Amount (KD) *</label>
                <input
                  type="number"
                  value={manualAmount}
                  onChange={(e) => setManualAmount(e.target.value)}
                  placeholder="e.g. 150.000"
                  step="0.001"
                  min="0"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#5B9BD5]"
                />
              </div>
            )}

            {/* Points Preview */}
            <div className="flex items-center justify-between p-4 bg-gradient-to-r from-[#1B2A5E] to-[#5B9BD5] rounded-xl text-white">
              <div className="flex items-center gap-2">
                <Star size={18} className="text-yellow-300" />
                <span className="font-semibold">Points You'll Earn</span>
              </div>
              <span className="text-2xl font-bold">{pointsPreview}</span>
            </div>

            {selectedInvoice.status === "unpaid" && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">This invoice is unpaid. It will go to admin review before points are awarded.</p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSubmit}
                disabled={submitMutation.isPending || (selectedInvoice.totalAmount === 0 && (!manualAmount || parseFloat(manualAmount) <= 0))}
                className="flex-1 py-3 bg-[#1B2A5E] text-white rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                Submit Invoice
              </button>
            </div>
          </div>
        )}

        {/* ── STEP: SUCCESS ── */}
        {step === "success" && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-[#1B2A5E]">Invoice Submitted!</h3>
              <p className="text-sm text-gray-500 mt-1">Your invoice has been received and is being processed.</p>
            </div>
            <div className="bg-gradient-to-r from-[#1B2A5E] to-[#5B9BD5] rounded-xl p-5 text-white">
              <p className="text-sm opacity-80 mb-1">Points Earned</p>
              <p className="text-4xl font-bold">+{earnedPoints}</p>
              <p className="text-sm opacity-80 mt-1">points added to your account</p>
            </div>
            <button
              onClick={handleReset}
              className="w-full py-3 bg-[#1B2A5E] text-white rounded-xl text-sm font-semibold hover:opacity-90"
            >
              Submit Another Invoice
            </button>
          </div>
        )}
      </div>
    </CustomerLayout>
  );
}
