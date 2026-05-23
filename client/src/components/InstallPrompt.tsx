import { useEffect, useState } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { X, Download, Smartphone } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const STORAGE_KEY = "prime-rewards-install-dismissed";
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export default function InstallPrompt() {
  const { t, language } = useLanguage();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed (standalone mode)
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently
    const dismissed = localStorage.getItem(STORAGE_KEY);
    if (dismissed) {
      const dismissedAt = parseInt(dismissed, 10);
      if (Date.now() - dismissedAt < DISMISS_DURATION_MS) return;
    }

    // Detect iOS
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const safari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);
    setIsIOS(ios && safari);

    if (ios && safari) {
      // Show iOS-specific instructions after 3 seconds
      const timer = setTimeout(() => setShowPrompt(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: listen for beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setTimeout(() => setShowPrompt(true), 3000);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    }
    setShowPrompt(false);
  };

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
    setShowPrompt(false);
  };

  if (!showPrompt || isInstalled) return null;

  const isRTL = language === "ar";

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 p-4 animate-in slide-in-from-bottom-4 duration-500"
      dir={isRTL ? "rtl" : "ltr"}
    >
      <div className="max-w-md mx-auto bg-[#1B2A5E] rounded-2xl shadow-2xl border border-[#5B9BD5]/30 overflow-hidden">
        {/* Top gradient bar */}
        <div className="h-1 bg-gradient-to-r from-[#5B9BD5] via-yellow-400 to-[#5B9BD5]" />

        <div className="p-4">
          <div className={`flex items-start gap-3 ${isRTL ? "flex-row-reverse" : ""}`}>
            {/* Icon */}
            <div className="flex-shrink-0">
              <img
                src="/manus-storage/prime-rewards-pwa-icon-v2-192_ed0be00d.png"
                alt="Prime Rewards"
                className="w-14 h-14 rounded-xl shadow-lg"
              />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className={`flex items-start justify-between ${isRTL ? "flex-row-reverse" : ""}`}>
                <div>
                  <h3 className="text-white font-bold text-base leading-tight">
                    {isRTL ? "أضف إلى الشاشة الرئيسية" : "Add to Home Screen"}
                  </h3>
                  <p className="text-[#5B9BD5] text-xs font-medium mt-0.5">
                    {isRTL ? "برايم ريواردز — PRIME Printing Co." : "Prime Rewards — PRIME Printing Co."}
                  </p>
                </div>
                <button
                  onClick={handleDismiss}
                  className="text-white/50 hover:text-white transition-colors p-1 -mt-1 -mr-1 flex-shrink-0"
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <p className="text-white/70 text-xs mt-2 leading-relaxed">
                {isRTL
                  ? "ثبّت التطبيق على هاتفك للوصول السريع إلى نقاطك ومكافآتك"
                  : "Install the app for quick access to your points and rewards"}
              </p>

              {isIOS ? (
                /* iOS instructions */
                <div className="mt-3 bg-white/10 rounded-xl p-3">
                  <p className="text-white/80 text-xs font-medium mb-2">
                    {isRTL ? "كيفية التثبيت على iOS:" : "How to install on iOS:"}
                  </p>
                  <div className={`space-y-1.5 ${isRTL ? "text-right" : ""}`}>
                    <div className={`flex items-center gap-2 text-white/70 text-xs ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span className="w-5 h-5 rounded-full bg-[#5B9BD5] text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">1</span>
                      <span>{isRTL ? 'اضغط على زر "مشاركة"' : 'Tap the "Share" button'} <span className="text-[#5B9BD5]">⬆</span></span>
                    </div>
                    <div className={`flex items-center gap-2 text-white/70 text-xs ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span className="w-5 h-5 rounded-full bg-[#5B9BD5] text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">2</span>
                      <span>{isRTL ? 'اختر "إضافة إلى الشاشة الرئيسية"' : 'Select "Add to Home Screen"'}</span>
                    </div>
                    <div className={`flex items-center gap-2 text-white/70 text-xs ${isRTL ? "flex-row-reverse" : ""}`}>
                      <span className="w-5 h-5 rounded-full bg-[#5B9BD5] text-white text-xs flex items-center justify-center flex-shrink-0 font-bold">3</span>
                      <span>{isRTL ? 'اضغط "إضافة"' : 'Tap "Add"'}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleDismiss}
                    className="mt-3 w-full text-white/50 text-xs hover:text-white/80 transition-colors"
                  >
                    {isRTL ? "ربما لاحقاً" : "Maybe later"}
                  </button>
                </div>
              ) : (
                /* Android/Chrome install button */
                <div className={`flex gap-2 mt-3 ${isRTL ? "flex-row-reverse" : ""}`}>
                  <button
                    onClick={handleInstall}
                    className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 text-[#1B2A5E] font-bold text-sm py-2.5 px-4 rounded-xl transition-all duration-200 shadow-lg shadow-yellow-500/20"
                  >
                    <Download className="w-4 h-4" />
                    {isRTL ? "تثبيت التطبيق" : "Install App"}
                  </button>
                  <button
                    onClick={handleDismiss}
                    className="px-4 py-2.5 text-white/60 hover:text-white text-sm transition-colors rounded-xl hover:bg-white/10"
                  >
                    {isRTL ? "لاحقاً" : "Later"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
