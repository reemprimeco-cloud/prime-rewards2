import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, Clock, CheckCircle, XCircle, AlertTriangle,
  Loader2, ShieldCheck, ShieldAlert, ShieldX, Zap
} from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getLoginUrl } from "@/const";

type QBValidationState = "idle" | "checking" | "valid" | "invalid" | "warning";

export default function Invoices() {
  const { isAuthenticated } = useAuth();
  const { t, language, isRTL } = useLanguage();
  const { data: myInvoices, isLoading, refetch } = trpc.invoices.myInvoices.useQuery(
    { limit: 50 },
    { enabled: isAuthenticated }
  );
  const { data: qbStatus } = trpc.invoices.qbStatus.useQuery();

  const [showForm, setShowForm] = useState(false);
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [qbState, setQbState] = useState<QBValidationState>("idle");
  const [qbMessage, setQbMessage] = useState("");
  const [qbCustomerName, setQbCustomerName] = useState("");
  const [qbAmount, setQbAmount] = useState<number | null>(null);

  const STATUS_CONFIG = {
    pending: { icon: Clock, color: "text-yellow-600", bg: "bg-yellow-50", label: t.invoice_status_pending },
    approved: { icon: CheckCircle, color: "text-green-600", bg: "bg-green-50", label: t.invoice_status_approved },
    rejected: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", label: t.invoice_status_rejected },
    flagged: { icon: AlertTriangle, color: "text-orange-500", bg: "bg-orange-50", label: t.invoice_status_flagged },
  };

  const SOURCE_LABELS: Record<string, string> = {
    quickbooks: language === "ar" ? "كويك بوكس ✓" : "QuickBooks ✓",
    woocommerce: "WooCommerce ✓",
    manual: language === "ar" ? "يدوي" : "Manual",
  };

  const validateQBMutation = trpc.invoices.validateQB.useMutation({
    onSuccess: (data) => {
      if (data.validated) {
        setQbState("valid");
        setQbMessage(data.message);
        setQbCustomerName(data.customerName ?? "");
        if (data.totalAmount) {
          setQbAmount(data.totalAmount);
          setInvoiceAmount(String(data.totalAmount));
        }
      } else if (data.reason === "QB_NOT_CONNECTED") {
        setQbState("warning");
        setQbMessage(data.message);
      } else {
        setQbState("invalid");
        setQbMessage(data.message);
      }
    },
    onError: () => {
      setQbState("warning");
      setQbMessage(language === "ar" ? "تعذّر التحقق من كويك بوكس. يمكنك المتابعة يدوياً." : "Could not verify with QuickBooks. You may proceed manually.");
    },
  });

  const submitMutation = trpc.invoices.submit.useMutation({
    onSuccess: (data) => {
      const msg = data.qbValidated
        ? (language === "ar" ? "تم التحقق من الفاتورة عبر كويك بوكس وإرسالها بنجاح!" : "Invoice verified via QuickBooks and submitted!")
        : t.invoice_success;
      toast.success(msg);
      setInvoiceNumber("");
      setInvoiceAmount("");
      setShowForm(false);
      setQbState("idle");
      setQbMessage("");
      setQbCustomerName("");
      setQbAmount(null);
      refetch();
    },
    onError: (err) => toast.error(err.message),
  });

  // Auto-validate when invoice number is entered (debounced)
  useEffect(() => {
    if (!invoiceNumber.trim() || invoiceNumber.length < 3) {
      setQbState("idle");
      setQbMessage("");
      setQbCustomerName("");
      setQbAmount(null);
      return;
    }
    const timer = setTimeout(() => {
      setQbState("checking");
      validateQBMutation.mutate({ invoiceNumber: invoiceNumber.trim() });
    }, 800);
    return () => clearTimeout(timer);
  }, [invoiceNumber]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoiceNumber.trim() || !invoiceAmount) return;
    submitMutation.mutate({
      invoiceNumber: invoiceNumber.trim(),
      invoiceAmount: parseFloat(invoiceAmount),
      skipQBValidation: qbState === "warning",
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-[#1B2A5E] mb-4">
            {language === "ar" ? "سجّل دخولك لإرسال الفواتير" : "Sign in to submit invoices"}
          </h2>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">{t.login}</a>
        </div>
      </div>
    );
  }

  const qbConnected = qbStatus?.connected ?? false;

  return (
    <CustomerLayout>
      <div className={isRTL ? "md:mr-56" : "md:ml-56"}>
        <div className="prime-gradient text-white px-4 pt-6 pb-12">
          <div className="container max-w-lg flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold mb-1">{t.invoice_title}</h1>
              <p className="text-white/70 text-sm">{t.invoice_sub}</p>
            </div>
            <button
              onClick={() => setShowForm(!showForm)}
              className="flex items-center gap-2 bg-white text-[#1B2A5E] px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-100 transition-colors"
            >
              <Plus size={16} />
              {t.invoice_submit}
            </button>
          </div>
        </div>

        <div className="container max-w-lg -mt-8 pb-6 space-y-4">
          {/* Submit Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5"
              >
                {/* QB status badge */}
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-[#1B2A5E]">{t.invoice_title}</h3>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${qbConnected ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                    {qbConnected ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}
                    {qbConnected
                      ? (language === "ar" ? "كويك بوكس متصل" : "QuickBooks Connected")
                      : (language === "ar" ? "مراجعة يدوية" : "Manual Review")}
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm text-gray-600 mb-1.5 block font-medium">{t.invoice_number_label} *</label>
                    <div className="relative">
                      <input
                        value={invoiceNumber}
                        onChange={e => setInvoiceNumber(e.target.value)}
                        placeholder={t.invoice_number_placeholder}
                        required
                        className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#5B9BD5] focus:ring-1 focus:ring-[#5B9BD5] pr-10"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {qbState === "checking" && <Loader2 size={16} className="animate-spin text-gray-400" />}
                        {qbState === "valid" && <ShieldCheck size={16} className="text-green-500" />}
                        {qbState === "invalid" && <ShieldX size={16} className="text-red-500" />}
                        {qbState === "warning" && <ShieldAlert size={16} className="text-yellow-500" />}
                      </div>
                    </div>

                    {/* QB validation feedback */}
                    <AnimatePresence>
                      {qbState !== "idle" && qbState !== "checking" && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className={`mt-2 px-3 py-2 rounded-lg text-xs font-medium flex items-start gap-2 ${
                            qbState === "valid" ? "bg-green-50 text-green-700" :
                            qbState === "invalid" ? "bg-red-50 text-red-600" :
                            "bg-yellow-50 text-yellow-700"
                          }`}
                        >
                          {qbState === "valid" && <ShieldCheck size={13} className="flex-shrink-0 mt-0.5" />}
                          {qbState === "invalid" && <ShieldX size={13} className="flex-shrink-0 mt-0.5" />}
                          {qbState === "warning" && <ShieldAlert size={13} className="flex-shrink-0 mt-0.5" />}
                          <div>
                            <p>{qbMessage}</p>
                            {qbCustomerName && (
                              <p className="mt-0.5 opacity-80">
                                {language === "ar" ? "العميل:" : "Customer:"} {qbCustomerName}
                              </p>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <label className="text-sm text-gray-600 mb-1.5 block font-medium">{t.invoice_amount_label} *</label>
                    <input
                      type="number"
                      value={invoiceAmount}
                      onChange={e => setInvoiceAmount(e.target.value)}
                      placeholder={t.invoice_amount_placeholder}
                      min="1"
                      step="0.001"
                      required
                      className={`w-full border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#5B9BD5] focus:ring-1 focus:ring-[#5B9BD5] ${qbAmount ? "border-green-300 bg-green-50/30" : "border-gray-200"}`}
                    />
                    {invoiceAmount && parseFloat(invoiceAmount) > 0 && (
                      <p className="text-xs text-[#5B9BD5] mt-1.5 flex items-center gap-1">
                        <Zap size={11} />
                        {language === "ar"
                          ? `ستكسب تقريباً ${Math.floor(parseFloat(invoiceAmount) / 10)} نقطة`
                          : `You'll earn approximately ${Math.floor(parseFloat(invoiceAmount) / 10)} points`}
                        {qbAmount && <span className="text-green-600 ml-1">{language === "ar" ? "(مُتحقق من كويك بوكس)" : "(verified from QuickBooks)"}</span>}
                      </p>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => { setShowForm(false); setQbState("idle"); }}
                      className="flex-1 py-3 rounded-xl border border-gray-200 text-gray-600 font-semibold text-sm"
                    >
                      {t.cancel}
                    </button>
                    <button
                      type="submit"
                      disabled={submitMutation.isPending || qbState === "invalid"}
                      className="flex-1 py-3 rounded-xl bg-[#1B2A5E] text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {submitMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : null}
                      {t.invoice_submit}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Info Banner */}
          <div className="bg-[#EBF4FF] rounded-xl p-4 flex gap-3">
            <FileText size={18} className="text-[#5B9BD5] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-[#1B2A5E]">
                {language === "ar" ? "كيف يعمل" : "How it works"}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">{t.invoice_tip}</p>
              {qbConnected && (
                <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                  <ShieldCheck size={11} />
                  {language === "ar" ? "التحقق التلقائي عبر كويك بوكس مفعّل" : "Automatic QuickBooks verification is active"}
                </p>
              )}
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
                <p className="font-medium">{t.invoice_empty}</p>
                <button
                  onClick={() => setShowForm(true)}
                  className="mt-4 inline-flex items-center gap-2 bg-[#1B2A5E] text-white px-6 py-2.5 rounded-xl font-semibold text-sm"
                >
                  <Plus size={16} />
                  {t.invoice_submit}
                </button>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {myInvoices.map((inv) => {
                  const status = STATUS_CONFIG[inv.status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.pending;
                  const StatusIcon = status.icon;
                  return (
                    <div key={inv.id} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-800 text-sm">#{inv.invoiceNumber}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{format(new Date(inv.submittedAt), "MMM d, yyyy · h:mm a")}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="font-bold text-[#1B2A5E] text-sm">
                            {parseFloat(String(inv.invoiceAmount)).toLocaleString()} {t.currency}
                          </p>
                          {inv.status === "approved" && (
                            <p className="text-xs text-green-600 font-medium">+{inv.pointsEarned} {t.points_abbr}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${status.bg} ${status.color}`}>
                          <StatusIcon size={12} />
                          {status.label}
                        </div>
                        {inv.multiplierApplied > 1 && (
                          <span className="text-xs bg-[#EBF4FF] text-[#5B9BD5] px-2 py-1 rounded-full font-medium">
                            {inv.multiplierApplied}x {language === "ar" ? "مكافأة" : "bonus"}
                          </span>
                        )}
                        {(inv as any).source && (inv as any).source !== "manual" && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-1 rounded-full font-medium">
                            {SOURCE_LABELS[(inv as any).source] ?? (inv as any).source}
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
