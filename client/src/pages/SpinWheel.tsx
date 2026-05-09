import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import CustomerLayout from "@/components/CustomerLayout";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Star, Gift, Truck, Palette, Zap, Loader2, Clock } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getLoginUrl } from "@/const";

// Segments with both English and Arabic labels
const SEGMENTS_EN = [
  { label: "50 Points", color: "#1B2A5E", textColor: "#fff" },
  { label: "10% Off", color: "#5B9BD5", textColor: "#fff" },
  { label: "100 Points", color: "#2d4a9e", textColor: "#fff" },
  { label: "Free Delivery", color: "#10B981", textColor: "#fff" },
  { label: "200 Points", color: "#6366F1", textColor: "#fff" },
  { label: "20% Off", color: "#F59E0B", textColor: "#1B2A5E" },
  { label: "Free Design", color: "#EC4899", textColor: "#fff" },
  { label: "2x Points", color: "#F97316", textColor: "#fff" },
  { label: "Try Again", color: "#94A3B8", textColor: "#fff" },
];

const SEGMENTS_AR = [
  { label: "50 نقطة", color: "#1B2A5E", textColor: "#fff" },
  { label: "خصم 10%", color: "#5B9BD5", textColor: "#fff" },
  { label: "100 نقطة", color: "#2d4a9e", textColor: "#fff" },
  { label: "توصيل مجاني", color: "#10B981", textColor: "#fff" },
  { label: "200 نقطة", color: "#6366F1", textColor: "#fff" },
  { label: "خصم 20%", color: "#F59E0B", textColor: "#1B2A5E" },
  { label: "تصميم مجاني", color: "#EC4899", textColor: "#fff" },
  { label: "نقاط ×2", color: "#F97316", textColor: "#fff" },
  { label: "حظاً أوفر", color: "#94A3B8", textColor: "#fff" },
];

function SpinWheelCanvas({ spinning, targetIndex, onAnimationEnd, language }: {
  spinning: boolean;
  targetIndex: number;
  onAnimationEnd: () => void;
  language: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const animRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);
  const DURATION = 4000;
  const SEGMENTS = language === "ar" ? SEGMENTS_AR : SEGMENTS_EN;

  const drawWheel = (rotation: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = cx - 4;
    const segCount = SEGMENTS.length;
    const segAngle = (2 * Math.PI) / segCount;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.2)";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, 2 * Math.PI);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();

    SEGMENTS.forEach((seg, i) => {
      const startAngle = rotation + i * segAngle - Math.PI / 2;
      const endAngle = startAngle + segAngle;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + segAngle / 2);
      ctx.textAlign = "right";
      ctx.fillStyle = seg.textColor;
      ctx.font = `bold ${canvas.width < 280 ? 9 : 11}px Noto Sans Arabic, Inter, sans-serif`;
      ctx.fillText(seg.label, radius - 12, 4);
      ctx.restore();
    });

    ctx.beginPath();
    ctx.arc(cx, cy, 24, 0, 2 * Math.PI);
    ctx.fillStyle = "#1B2A5E";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = "#5B9BD5";
    ctx.font = "bold 16px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★", cx, cy);
  };

  useEffect(() => { drawWheel(0); }, [language]);

  useEffect(() => {
    if (!spinning) return;
    const segCount = SEGMENTS.length;
    const segAngle = (2 * Math.PI) / segCount;
    const targetAngle = 2 * Math.PI * 5 + (segCount - targetIndex) * segAngle - segAngle / 2;
    startTimeRef.current = performance.now();
    const startRotation = rotationRef.current;

    const animate = (now: number) => {
      const elapsed = now - startTimeRef.current;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startRotation + targetAngle * eased;
      rotationRef.current = current;
      drawWheel(current);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        onAnimationEnd();
      }
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [spinning, targetIndex]);

  return (
    <div className="relative">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-10">
        <div className="w-0 h-0 border-l-[12px] border-r-[12px] border-t-[24px] border-l-transparent border-r-transparent border-t-[#1B2A5E]" />
      </div>
      <canvas
        ref={canvasRef}
        width={280}
        height={280}
        className="rounded-full"
        style={{ maxWidth: "100%", aspectRatio: "1" }}
      />
    </div>
  );
}

export default function SpinWheel() {
  const { isAuthenticated } = useAuth();
  const { t, language, isRTL } = useLanguage();
  const { data: spinStatus, refetch: refetchStatus } = trpc.spin.canSpin.useQuery(undefined, { enabled: isAuthenticated });
  const { data: customer } = trpc.customer.me.useQuery(undefined, { enabled: isAuthenticated });
  const utils = trpc.useUtils();

  const [spinning, setSpinning] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [result, setResult] = useState<{ description: string; rewardType: string; value?: number } | null>(null);
  const [showResult, setShowResult] = useState(false);

  const spinMutation = trpc.spin.spin.useMutation({
    onSuccess: (data) => {
      const idx = data.segmentIndex ?? 0;
      setTargetIndex(idx);
      setResult({ description: data.description, rewardType: data.rewardType, value: data.value });
      setSpinning(true);
    },
    onError: (err) => {
      toast.error(err.message);
      setSpinning(false);
    },
  });

  const handleSpin = () => {
    if (spinning || spinMutation.isPending) return;
    setShowResult(false);
    setResult(null);
    spinMutation.mutate();
  };

  const handleAnimationEnd = () => {
    setSpinning(false);
    setShowResult(true);
    refetchStatus();
    utils.customer.me.invalidate();
    utils.notifications.unreadCount.invalidate();
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-[#1B2A5E] mb-4">
            {language === "ar" ? "سجّل دخولك لتدوير العجلة" : "Sign in to spin the wheel"}
          </h2>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">{t.login}</a>
        </div>
      </div>
    );
  }

  const canSpin = spinStatus?.canSpin ?? false;

  const prizes = [
    { icon: Star, label: language === "ar" ? "50 نقطة" : "50 Points", color: "#1B2A5E" },
    { icon: Star, label: language === "ar" ? "100 نقطة" : "100 Points", color: "#2d4a9e" },
    { icon: Star, label: language === "ar" ? "200 نقطة" : "200 Points", color: "#6366F1" },
    { icon: Gift, label: language === "ar" ? "خصم 10%" : "10% Discount", color: "#5B9BD5" },
    { icon: Gift, label: language === "ar" ? "خصم 20%" : "20% Discount", color: "#F59E0B" },
    { icon: Truck, label: language === "ar" ? "توصيل مجاني" : "Free Delivery", color: "#10B981" },
    { icon: Palette, label: language === "ar" ? "تصميم مجاني" : "Free Design", color: "#EC4899" },
    { icon: Zap, label: language === "ar" ? "نقاط ×2" : "2x Points", color: "#F97316" },
  ];

  return (
    <CustomerLayout>
      <div className={isRTL ? "md:mr-56" : "md:ml-56"}>
        <div className="prime-gradient text-white px-4 pt-6 pb-12">
          <div className="container max-w-lg text-center">
            <h1 className="text-2xl font-bold mb-1">{t.spin_title}</h1>
            <p className="text-white/70 text-sm">{t.spin_sub}</p>
          </div>
        </div>

        <div className="container max-w-lg -mt-8 pb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <Star size={16} className="text-yellow-400" fill="#FBBF24" />
              <span className="text-sm font-semibold text-gray-600">
                {(customer?.totalPoints ?? 0).toLocaleString()} {t.points_abbr}
              </span>
            </div>

            <div className="flex justify-center mb-6">
              <SpinWheelCanvas
                spinning={spinning}
                targetIndex={targetIndex}
                onAnimationEnd={handleAnimationEnd}
                language={language}
              />
            </div>

            {canSpin ? (
              <button
                onClick={handleSpin}
                disabled={spinning || spinMutation.isPending}
                className="w-full max-w-xs mx-auto flex items-center justify-center gap-3 bg-[#1B2A5E] text-white py-4 rounded-2xl font-bold text-lg hover:opacity-90 transition-all active:scale-95 disabled:opacity-60"
              >
                {spinning || spinMutation.isPending ? (
                  <Loader2 size={22} className="animate-spin" />
                ) : (
                  <RotateCcw size={22} />
                )}
                {spinning ? t.spin_spinning : t.spin_spin_btn}
              </button>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-gray-400 text-sm">
                  <Clock size={16} />
                  <span>{t.spin_already_spun}</span>
                </div>
                <p className="text-xs text-gray-400">{t.spin_come_back}</p>
              </div>
            )}
          </div>

          {/* Possible Prizes */}
          <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-semibold text-[#1B2A5E] mb-3">
              {language === "ar" ? "الجوائز المحتملة" : "Possible Prizes"}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {prizes.map(({ icon: Icon, label, color }) => (
                <div key={label} className="flex flex-col items-center gap-1 p-2 rounded-xl bg-gray-50">
                  <Icon size={18} style={{ color }} />
                  <span className="text-xs text-gray-600 text-center leading-tight">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Result Modal */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4"
            onClick={() => setShowResult(false)}
          >
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-white rounded-3xl p-8 text-center max-w-sm w-full shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ delay: 0.3, duration: 0.5 }}
                className="text-6xl mb-4"
              >
                🎉
              </motion.div>
              <h2 className="text-2xl font-bold text-[#1B2A5E] mb-2">
                {language === "ar" ? "مبروك!" : "You Won!"}
              </h2>
              <p className="text-lg font-semibold text-[#5B9BD5] mb-6">{result.description}</p>
              <button
                onClick={() => setShowResult(false)}
                className="w-full bg-[#1B2A5E] text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
              >
                {language === "ar" ? "رائع!" : "Awesome!"}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </CustomerLayout>
  );
}
