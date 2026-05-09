import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Bell, Home, Gift, RotateCcw, User, Users, FileText, LogOut, Menu, X, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { getLoginUrl } from "@/const";
import { useLanguage } from "@/contexts/LanguageContext";

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const [location] = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t, language, setLanguage, isRTL } = useLanguage();

  const { data: unreadCount } = trpc.notifications.unreadCount.useQuery(undefined, {
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  const navItems = [
    { href: "/dashboard", label: t.nav_dashboard, icon: Home },
    { href: "/rewards", label: t.nav_rewards, icon: Gift },
    { href: "/spin", label: t.nav_spin, icon: RotateCcw },
    { href: "/invoices", label: t.nav_invoices, icon: FileText },
    { href: "/profile", label: t.nav_profile, icon: User },
  ];

  const extraNavItems = [
    { href: "/referral", label: t.nav_referral, icon: Users },
    { href: "/transactions", label: t.nav_history, icon: FileText },
    { href: "/notifications", label: t.nav_notifications, icon: Bell },
  ];

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50" dir={isRTL ? "rtl" : "ltr"}>
        <div className="text-center p-8">
          <div className="w-16 h-16 rounded-full prime-gradient flex items-center justify-center mx-auto mb-4">
            <span className="text-white font-bold text-xl">P</span>
          </div>
          <h2 className="text-xl font-bold text-prime-navy mb-2">
            {language === "ar" ? "سجّل دخولك للمتابعة" : "Sign in to continue"}
          </h2>
          <p className="text-gray-500 mb-6">
            {language === "ar" ? "الوصول إلى حساب Prime Rewards" : "Access your Prime Rewards account"}
          </p>
          <a href={getLoginUrl()} className="inline-block bg-[#1B2A5E] text-white px-8 py-3 rounded-xl font-semibold hover:opacity-90 transition-opacity">
            {t.login}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir={isRTL ? "rtl" : "ltr"}>
      {/* Top Nav */}
      <header className="bg-[#1B2A5E] text-white sticky top-0 z-50 shadow-lg">
        <div className="container flex items-center justify-between h-14">
          <Link href="/dashboard" className="flex items-center gap-2">
            <img src="/manus-storage/prime-logo_d356d52a.jpg" alt="PRIME" className="h-7 w-auto rounded brightness-0 invert" />
          </Link>
          <div className="flex items-center gap-2">
            {/* Language Toggle */}
            <button
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-colors text-sm font-semibold"
              title={language === "en" ? "Switch to Arabic" : "Switch to English"}
            >
              <span className="text-base leading-none">{language === "en" ? "🇰🇼" : "🇬🇧"}</span>
              <span className="text-white/90 text-xs">{language === "en" ? "العربية" : "EN"}</span>
            </button>
            <Link href="/notifications" className="relative p-2">
              <Bell size={20} className="text-white/80" />
              {(unreadCount ?? 0) > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-[#5B9BD5] rounded-full text-[10px] flex items-center justify-center font-bold">
                  {unreadCount}
                </span>
              )}
            </Link>
            <button onClick={() => setMenuOpen(!menuOpen)} className="p-2 md:hidden">
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {menuOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMenuOpen(false)}>
          <div
            className={`absolute top-14 w-72 bg-white h-full shadow-xl ${isRTL ? "left-0" : "right-0"}`}
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 bg-[#1B2A5E] text-white">
              <p className="font-semibold">{user?.name}</p>
              <p className="text-sm text-white/70">{user?.email}</p>
            </div>
            <nav className="p-4 space-y-1">
              {navItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-colors ${
                    location === href
                      ? "bg-[#EBF4FF] text-[#1B2A5E]"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                  <ChevronRight size={16} className={`${isRTL ? "mr-auto rotate-180" : "ml-auto"} text-gray-400`} />
                </Link>
              ))}
              {extraNavItems.map(({ href, label, icon: Icon }) => (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-colors text-sm ${
                    location === href
                      ? "bg-[#EBF4FF] text-[#1B2A5E]"
                      : "text-gray-500 hover:bg-gray-100"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              ))}
              <button
                onClick={() => { logout(); setMenuOpen(false); }}
                className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-red-500 hover:bg-red-50 w-full mt-4"
              >
                <LogOut size={18} />
                {t.nav_sign_out}
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className={`pb-20 md:pb-6 ${isRTL ? "md:mr-56 md:ml-0" : "md:ml-56"}`}>
        {children}
      </main>

      {/* Bottom Tab Bar (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 md:hidden z-30 safe-area-pb">
        <div className="flex items-center justify-around h-16">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link key={href} href={href} className="flex flex-col items-center gap-0.5 flex-1 py-2">
                <Icon
                  size={22}
                  className={active ? "text-[#1B2A5E]" : "text-gray-400"}
                  strokeWidth={active ? 2.5 : 1.5}
                />
                <span className={`text-[10px] font-medium ${active ? "text-[#1B2A5E]" : "text-gray-400"}`}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <div className={`hidden md:block fixed top-14 h-[calc(100vh-3.5rem)] w-56 bg-[#1B2A5E] text-white z-20 overflow-y-auto ${isRTL ? "right-0" : "left-0"}`}>
        <nav className="p-4 space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = location === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${
                  active
                    ? "bg-[#5B9BD5] text-white"
                    : "text-white/70 hover:bg-white/10 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {label}
              </Link>
            );
          })}
          <div className="pt-2 border-t border-white/10 mt-2 space-y-1">
            {extraNavItems.map(({ href, label, icon: Icon }) => {
              const active = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all text-sm ${
                    active
                      ? "bg-[#5B9BD5] text-white"
                      : "text-white/60 hover:bg-white/10 hover:text-white"
                  }`}
                >
                  <Icon size={16} />
                  {label}
                </Link>
              );
            })}
          </div>
        </nav>
        <div className="absolute bottom-4 left-0 right-0 px-4">
          <button
            onClick={logout}
            className="flex items-center gap-3 px-4 py-3 rounded-xl font-medium text-white/60 hover:bg-white/10 hover:text-white w-full transition-all"
          >
            <LogOut size={18} />
            {t.nav_sign_out}
          </button>
        </div>
      </div>
    </div>
  );
}
