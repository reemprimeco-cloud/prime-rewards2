import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import {
  BarChart2, Users, FileText, Gift, Megaphone, Shield, Home, LogOut, Menu, Settings, MessageCircle, AlertTriangle, TrendingUp, ClipboardList, Bell
} from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useLanguage } from "@/contexts/LanguageContext";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, loading, logout } = useAuth();
  const [location] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { t, language, setLanguage, isRTL } = useLanguage();

  const adminNav = [
    { href: "/admin", label: t.admin_nav_dashboard, icon: BarChart2 },
    { href: "/admin/customers", label: t.admin_nav_customers, icon: Users },
    { href: "/admin/invoices", label: t.admin_nav_invoices, icon: FileText },
    { href: "/admin/rewards", label: t.admin_nav_rewards, icon: Gift },
    { href: "/admin/campaigns", label: t.admin_nav_campaigns, icon: Megaphone },
    { href: "/admin/fraud", label: t.admin_nav_fraud, icon: Shield },
    { href: "/admin/whatsapp", label: language === "ar" ? "سجلات واتساب" : "WhatsApp Logs", icon: MessageCircle },
    { href: "/admin/suspicious", label: language === "ar" ? "حسابات مشبوهة" : "Suspicious", icon: AlertTriangle },
    { href: "/admin/analytics", label: language === "ar" ? "التحليلات" : "Analytics", icon: TrendingUp },
    { href: "/admin/registry", label: language === "ar" ? "سجل الفواتير" : "Invoice Registry", icon: ClipboardList },
    { href: "/admin/notifications", label: language === "ar" ? "الإشعارات" : "Notifications", icon: Bell },
    { href: "/admin/settings", label: t.admin_nav_settings, icon: Settings },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-[#5B9BD5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center p-8">
          <h2 className="text-xl font-bold text-[#1B2A5E] mb-4">
            {language === "ar" ? "مطلوب صلاحيات المسؤول" : "Admin access required"}
          </h2>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">{t.login}</a>
        </div>
      </div>
    );
  }

  if (user?.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center p-8">
          <Shield size={48} className="text-gray-300 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">
            {language === "ar" ? "غير مصرح بالوصول" : "Access Denied"}
          </h2>
          <p className="text-gray-500 mb-4">
            {language === "ar" ? "ليس لديك صلاحيات المسؤول." : "You don't have admin privileges."}
          </p>
          <Link href="/dashboard" className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold">
            {language === "ar" ? "الذهاب للوحة التحكم" : "Go to Dashboard"}
          </Link>
        </div>
      </div>
    );
  }

  const currentLabel = adminNav.find(n => n.href === location)?.label ?? t.admin_panel;

  return (
    <div className="min-h-screen bg-gray-50 flex" dir={isRTL ? "rtl" : "ltr"}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 z-50 w-60 bg-[#1B2A5E] text-white transform transition-transform duration-200 lg:translate-x-0 lg:static lg:flex-shrink-0
        ${isRTL ? "right-0" : "left-0"}
        ${sidebarOpen ? "translate-x-0" : isRTL ? "translate-x-full" : "-translate-x-full"}
      `}>
        <div className="p-5 border-b border-white/10">
          <div className="flex items-center gap-2 mb-1">
            <img src="/manus-storage/prime-rewards-pwa-icon-v2-192_ed0be00d.png" alt="Prime Rewards" className="h-9 w-9 rounded-xl" />
            <span className="font-bold text-white text-sm leading-tight">
              <span className="text-yellow-400">PRIME</span> Rewards
            </span>
          </div>
          <p className="text-xs text-white/50 font-medium tracking-wider uppercase">{t.admin_panel}</p>
        </div>
        <nav className="p-4 space-y-1 flex-1">
          {adminNav.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  active ? "bg-[#5B9BD5] text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-white/10">
          <div className="px-4 py-2 mb-2">
            <p className="text-sm font-medium text-white truncate">{user.name}</p>
            <p className="text-xs text-white/50 truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white w-full transition-all text-sm"
          >
            <LogOut size={16} />
            {t.nav_sign_out}
          </button>
          <Link
            href="/dashboard"
            className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/60 hover:bg-white/10 hover:text-white w-full transition-all text-sm mt-1"
          >
            <Home size={16} />
            {t.admin_back_to_site}
          </Link>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="bg-white border-b border-gray-200 px-4 h-14 flex items-center gap-4 sticky top-0 z-30">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 rounded-lg hover:bg-gray-100">
            <Menu size={20} className="text-gray-600" />
          </button>
          <div className="flex-1">
            <h1 className="text-base font-semibold text-[#1B2A5E]">{currentLabel}</h1>
          </div>
          {/* Language Toggle */}
          <button
            onClick={() => setLanguage(language === "en" ? "ar" : "en")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#EBF4FF] hover:bg-[#d4eaf7] transition-colors text-sm font-semibold"
            title={language === "en" ? "Switch to Arabic" : "Switch to English"}
          >
            <span className="text-base leading-none">{language === "en" ? "🇰🇼" : "🇬🇧"}</span>
            <span className="text-[#1B2A5E] text-xs">{language === "en" ? "العربية" : "EN"}</span>
          </button>
          <span className="text-xs bg-[#EBF4FF] text-[#1B2A5E] px-3 py-1 rounded-full font-semibold">Admin</span>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
