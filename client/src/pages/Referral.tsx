import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState, useEffect } from "react";
import { Users, Copy, Check, Share2, QrCode, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

export default function Referral() {
  const { data: customer, isLoading } = trpc.customer.me.useQuery();
  const { t, language, isRTL } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const referralUrl = customer?.referralCode
    ? `${window.location.origin}/?ref=${customer.referralCode}`
    : "";

  useEffect(() => {
    if (!referralUrl) return;
    QRCode.toDataURL(referralUrl, {
      width: 256,
      margin: 2,
      color: { dark: "#1B2A5E", light: "#FFFFFF" },
    }).then(setQrDataUrl).catch(console.error);
  }, [referralUrl]);

  const handleCopy = () => {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    toast.success(t.referral_copied);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralUrl) return;
    if (navigator.share) {
      await navigator.share({
        title: language === "ar" ? "انضم إلى Prime Rewards!" : "Join Prime Rewards!",
        text: language === "ar"
          ? "اكسب نقاطاً ومكافآت مع كل طلب من PRIME للطباعة. استخدم رابط الإحالة الخاص بي للبدء!"
          : "Earn points and rewards with every PRIME Printing Co. order. Use my referral link to get started!",
        url: referralUrl,
      });
    } else {
      handleCopy();
    }
  };

  const steps = [
    { step: "1", text: t.referral_step1 },
    { step: "2", text: t.referral_step2 },
    { step: "3", text: t.referral_step3 },
  ];

  return (
    <CustomerLayout>
      <div className={`max-w-lg mx-auto px-4 py-6 space-y-5 ${isRTL ? "md:mr-56" : "md:ml-56"}`}>
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl prime-gradient flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1B2A5E]">{t.referral_title}</h1>
          <p className="text-gray-500 mt-2">{t.referral_sub}</p>
        </div>

        {/* How it works */}
        <div className="bg-[#EBF4FF] rounded-2xl p-5">
          <h2 className="font-bold text-[#1B2A5E] mb-4">{t.referral_how_title}</h2>
          <div className="space-y-3">
            {steps.map(({ step, text }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#1B2A5E] text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {step}
                </div>
                <p className="text-sm text-gray-700">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 size={28} className="animate-spin text-[#5B9BD5]" />
          </div>
        ) : (
          <>
            {/* Referral Code */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">{t.referral_your_code}</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 font-mono font-bold text-[#1B2A5E] text-lg tracking-widest" dir="ltr">
                  {customer?.referralCode ?? "—"}
                </div>
                <button
                  onClick={handleCopy}
                  className="p-3 rounded-xl bg-[#1B2A5E] text-white hover:opacity-90 transition-opacity"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            {/* Referral Link */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">{t.referral_share_link}</p>
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 break-all mb-3 font-mono" dir="ltr">
                {referralUrl || (language === "ar" ? "جاري التحميل..." : "Loading...")}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 border border-[#1B2A5E] text-[#1B2A5E] py-2.5 rounded-xl font-semibold text-sm hover:bg-[#EBF4FF] transition-colors"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  {language === "ar" ? "نسخ الرابط" : "Copy Link"}
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#1B2A5E] text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <Share2 size={15} />
                  {language === "ar" ? "مشاركة" : "Share"}
                </button>
              </div>
            </div>

            {/* QR Code */}
            {qrDataUrl && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="flex items-center gap-2 justify-center mb-4">
                  <QrCode size={18} className="text-[#1B2A5E]" />
                  <p className="font-semibold text-[#1B2A5E]">{t.referral_qr_title}</p>
                </div>
                <div className="flex justify-center">
                  <div className="p-4 bg-white border-2 border-[#1B2A5E] rounded-2xl inline-block">
                    <img src={qrDataUrl} alt="Referral QR Code" className="w-48 h-48" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">
                  {language === "ar" ? "شارك رمز QR هذا ليقوم الأصدقاء بمسحه والانضمام" : "Share this QR code for friends to scan and join"}
                </p>
                <a
                  href={qrDataUrl}
                  download="prime-rewards-referral-qr.png"
                  className="inline-flex items-center gap-2 mt-3 text-sm text-[#5B9BD5] font-semibold hover:opacity-80"
                >
                  {t.referral_download_qr}
                </a>
              </div>
            )}

            {/* Referral Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-[#1B2A5E] mb-4 flex items-center gap-2">
                <Gift size={18} className="text-[#5B9BD5]" />
                {language === "ar" ? "إحصائيات الإحالة" : "Your Referral Stats"}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#EBF4FF] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#1B2A5E]">—</div>
                  <div className="text-xs text-gray-500 mt-1">{language === "ar" ? "الأصدقاء المُحالون" : "Friends Referred"}</div>
                </div>
                <div className="bg-[#EBF4FF] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#5B9BD5]">—</div>
                  <div className="text-xs text-gray-500 mt-1">{language === "ar" ? "نقاط المكافأة" : "Bonus Points Earned"}</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </CustomerLayout>
  );
}
