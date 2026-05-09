import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { useState, useEffect, useRef } from "react";
import { Users, Copy, Check, Share2, QrCode, Loader2, Gift } from "lucide-react";
import { toast } from "sonner";
import QRCode from "qrcode";

export default function Referral() {
  const { data: customer, isLoading } = trpc.customer.me.useQuery();
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
    toast.success("Referral link copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!referralUrl) return;
    if (navigator.share) {
      await navigator.share({
        title: "Join Prime Rewards!",
        text: "Earn points and rewards with every PRIME Printing Co. order. Use my referral link to get started!",
        url: referralUrl,
      });
    } else {
      handleCopy();
    }
  };

  return (
    <CustomerLayout>
      <div className="max-w-lg mx-auto px-4 py-6 space-y-5">
        {/* Header */}
        <div className="text-center">
          <div className="w-16 h-16 rounded-2xl prime-gradient flex items-center justify-center mx-auto mb-4">
            <Users size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-[#1B2A5E]">Refer & Earn</h1>
          <p className="text-gray-500 mt-2">Invite friends to join Prime Rewards and earn bonus points when they sign up.</p>
        </div>

        {/* How it works */}
        <div className="bg-[#EBF4FF] rounded-2xl p-5">
          <h2 className="font-bold text-[#1B2A5E] mb-4">How It Works</h2>
          <div className="space-y-3">
            {[
              { step: "1", text: "Share your unique referral link or QR code" },
              { step: "2", text: "Friend signs up using your link" },
              { step: "3", text: "You both earn bonus points!" },
            ].map(({ step, text }) => (
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
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Your Referral Code</p>
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-gray-50 rounded-xl px-4 py-3 font-mono font-bold text-[#1B2A5E] text-lg tracking-widest">
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
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wider">Referral Link</p>
              <div className="bg-gray-50 rounded-xl px-4 py-3 text-xs text-gray-600 break-all mb-3 font-mono">
                {referralUrl || "Loading..."}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCopy}
                  className="flex-1 flex items-center justify-center gap-2 border border-[#1B2A5E] text-[#1B2A5E] py-2.5 rounded-xl font-semibold text-sm hover:bg-[#EBF4FF] transition-colors"
                >
                  {copied ? <Check size={15} /> : <Copy size={15} />}
                  Copy Link
                </button>
                <button
                  onClick={handleShare}
                  className="flex-1 flex items-center justify-center gap-2 bg-[#1B2A5E] text-white py-2.5 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
                >
                  <Share2 size={15} />
                  Share
                </button>
              </div>
            </div>

            {/* QR Code */}
            {qrDataUrl && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
                <div className="flex items-center gap-2 justify-center mb-4">
                  <QrCode size={18} className="text-[#1B2A5E]" />
                  <p className="font-semibold text-[#1B2A5E]">Referral QR Code</p>
                </div>
                <div className="flex justify-center">
                  <div className="p-4 bg-white border-2 border-[#1B2A5E] rounded-2xl inline-block">
                    <img src={qrDataUrl} alt="Referral QR Code" className="w-48 h-48" />
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-3">Share this QR code for friends to scan and join</p>
                <a
                  href={qrDataUrl}
                  download="prime-rewards-referral-qr.png"
                  className="inline-flex items-center gap-2 mt-3 text-sm text-[#5B9BD5] font-semibold hover:opacity-80"
                >
                  Download QR Code
                </a>
              </div>
            )}

            {/* Referral Stats */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-semibold text-[#1B2A5E] mb-4 flex items-center gap-2">
                <Gift size={18} className="text-[#5B9BD5]" />
                Your Referral Stats
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#EBF4FF] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#1B2A5E]">—</div>
                  <div className="text-xs text-gray-500 mt-1">Friends Referred</div>
                </div>
                <div className="bg-[#EBF4FF] rounded-xl p-4 text-center">
                  <div className="text-2xl font-bold text-[#5B9BD5]">—</div>
                  <div className="text-xs text-gray-500 mt-1">Bonus Points Earned</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </CustomerLayout>
  );
}
