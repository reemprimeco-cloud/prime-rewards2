import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { motion } from "framer-motion";
import { Star, Gift, RotateCcw, Shield, ChevronRight, Award, Zap, Users } from "lucide-react";
import { Link } from "wouter";

const tiers = [
  { name: "Bronze", min: 0, max: 499, color: "#CD7F32", bg: "bg-amber-100", text: "text-amber-700" },
  { name: "Silver", min: 500, max: 1999, color: "#94A3B8", bg: "bg-slate-100", text: "text-slate-600" },
  { name: "Gold", min: 2000, max: 4999, color: "#F59E0B", bg: "bg-yellow-100", text: "text-yellow-700" },
  { name: "Platinum", min: 5000, max: null, color: "#6366F1", bg: "bg-indigo-100", text: "text-indigo-700" },
];

const features = [
  { icon: Star, title: "Earn Points", desc: "Get 1 point for every 10 AED spent on printing orders." },
  { icon: Gift, title: "Redeem Rewards", desc: "Exchange points for discounts, free services, and more." },
  { icon: RotateCcw, title: "Spin & Win", desc: "Daily spin wheel with bonus points and exclusive prizes." },
  { icon: Award, title: "Achievement Badges", desc: "Unlock badges as you reach milestones and level up." },
  { icon: Zap, title: "Seasonal Campaigns", desc: "Double points and special bonuses during promotions." },
  { icon: Shield, title: "Secure & Trusted", desc: "Fraud-protected system ensuring fair rewards for all." },
];

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="bg-[#1B2A5E] text-white">
        <div className="container flex items-center justify-between h-16">
          <img src="/manus-storage/prime-logo_d356d52a.jpg" alt="PRIME Printing Co." className="h-9 w-auto brightness-0 invert" />
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <Link href="/dashboard" className="flex items-center gap-2 bg-[#5B9BD5] text-white px-5 py-2 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
                My Dashboard <ChevronRight size={16} />
              </Link>
            ) : (
              <a href={getLoginUrl()} className="bg-[#5B9BD5] text-white px-5 py-2 rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity">
                Sign In
              </a>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="prime-gradient text-white py-16 md:py-24 overflow-hidden relative">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-10 right-10 w-64 h-64 rounded-full bg-white/20 blur-3xl" />
          <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full bg-white/10 blur-3xl" />
        </div>
        <div className="container relative z-10">
          <div className="max-w-2xl">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block bg-[#5B9BD5]/30 text-[#EBF4FF] text-sm font-semibold px-4 py-1.5 rounded-full mb-4">
                PRIME Printing Co. Loyalty Program
              </span>
              <h1 className="text-4xl md:text-5xl font-bold leading-tight mb-4">
                Earn Rewards Every Time You Print
              </h1>
              <p className="text-lg text-white/80 mb-8 leading-relaxed">
                Join Prime Rewards and turn every printing order into points. Unlock exclusive discounts, free services, and premium perks as you climb from Bronze to Platinum.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                {isAuthenticated ? (
                  <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 bg-white text-[#1B2A5E] px-8 py-3.5 rounded-xl font-bold text-base hover:bg-gray-100 transition-colors">
                    Go to Dashboard <ChevronRight size={18} />
                  </Link>
                ) : (
                  <a href={getLoginUrl()} className="inline-flex items-center justify-center gap-2 bg-white text-[#1B2A5E] px-8 py-3.5 rounded-xl font-bold text-base hover:bg-gray-100 transition-colors">
                    Join Now — It's Free <ChevronRight size={18} />
                  </a>
                )}
                <Link href="/rewards" className="inline-flex items-center justify-center gap-2 border-2 border-white/40 text-white px-8 py-3.5 rounded-xl font-semibold text-base hover:bg-white/10 transition-colors">
                  View Rewards
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-[#EBF4FF] py-8">
        <div className="container">
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { value: "1 pt", label: "per 10 AED spent" },
              { value: "Daily", label: "Spin & Win" },
              { value: "4 Tiers", label: "Bronze to Platinum" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-2xl font-bold text-[#1B2A5E]">{stat.value}</div>
                <div className="text-sm text-gray-500">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 bg-white">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1B2A5E] mb-3">Everything You Need to Earn More</h2>
            <p className="text-gray-500 max-w-xl mx-auto">Prime Rewards is designed to reward your loyalty with every order at PRIME Printing Co.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map(({ icon: Icon, title, desc }, i) => (
              <motion.div
                key={title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="w-12 h-12 rounded-xl bg-[#EBF4FF] flex items-center justify-center mb-4">
                  <Icon size={22} className="text-[#1B2A5E]" />
                </div>
                <h3 className="font-bold text-[#1B2A5E] mb-2">{title}</h3>
                <p className="text-gray-500 text-sm leading-relaxed">{desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="py-16 bg-gray-50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-[#1B2A5E] mb-3">Membership Tiers</h2>
            <p className="text-gray-500">The more you print, the higher you climb.</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-white rounded-2xl p-6 text-center shadow-sm border border-gray-100"
              >
                <div className={`w-14 h-14 rounded-full ${tier.bg} flex items-center justify-center mx-auto mb-3`}>
                  <Award size={26} style={{ color: tier.color }} />
                </div>
                <h3 className={`font-bold text-lg mb-1 ${tier.text}`}>{tier.name}</h3>
                <p className="text-xs text-gray-500">
                  {tier.max ? `${tier.min}–${tier.max} pts` : `${tier.min}+ pts`}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 prime-gradient text-white">
        <div className="container text-center">
          <Users size={40} className="mx-auto mb-4 text-white/70" />
          <h2 className="text-3xl font-bold mb-3">Ready to Start Earning?</h2>
          <p className="text-white/80 mb-8 max-w-md mx-auto">Join thousands of PRIME Printing Co. customers already enjoying exclusive rewards.</p>
          {isAuthenticated ? (
            <Link href="/dashboard" className="inline-flex items-center gap-2 bg-white text-[#1B2A5E] px-10 py-4 rounded-xl font-bold text-base hover:bg-gray-100 transition-colors">
              Go to My Dashboard <ChevronRight size={18} />
            </Link>
          ) : (
            <a href={getLoginUrl()} className="inline-flex items-center gap-2 bg-white text-[#1B2A5E] px-10 py-4 rounded-xl font-bold text-base hover:bg-gray-100 transition-colors">
              Get Started Free <ChevronRight size={18} />
            </a>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1B2A5E] text-white/60 py-8">
        <div className="container flex flex-col md:flex-row items-center justify-between gap-4">
          <img src="/manus-storage/prime-logo_d356d52a.jpg" alt="PRIME Printing Co." className="h-8 w-auto brightness-0 invert opacity-70" />
          <p className="text-sm">© 2026 PRIME Printing Co. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
