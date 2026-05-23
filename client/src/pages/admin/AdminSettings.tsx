import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Settings, Database, QrCode, RefreshCw, Loader2, Download, Shield, Star, Users, Link2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import QRCode from "qrcode";

const QR_PRESETS = [
  { label: "Invoice Submission", path: "/invoices", icon: "📄" },
  { label: "Rewards Store", path: "/rewards", icon: "🎁" },
  { label: "Dashboard", path: "/dashboard", icon: "🏠" },
  { label: "Spin & Win", path: "/spin", icon: "🎡" },
  { label: "Landing Page", path: "/", icon: "🌐" },
];

export default function AdminSettings() {
  // QuickBooks status
  const [qbStatus, setQbStatus] = useState<{ configured: boolean; connected: boolean; tokenExpired?: boolean; realmId: string | null; environment: string; connectedAt: string | null } | null>(null);
  const [disconnectingQb, setDisconnectingQb] = useState(false);
  const [loadingQbStatus, setLoadingQbStatus] = useState(true);

  useEffect(() => {
    fetch("/api/qb/status")
      .then(r => r.json())
      .then(data => { setQbStatus(data); setLoadingQbStatus(false); })
      .catch(() => setLoadingQbStatus(false));
  }, []);

  // Check URL params for QB callback result
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("qb_connected")) {
      toast.success("QuickBooks connected successfully!");
      window.history.replaceState({}, "", window.location.pathname);
      // Refresh status
      fetch("/api/qb/status").then(r => r.json()).then(setQbStatus);
    } else if (params.get("qb_error")) {
      toast.error(`QuickBooks connection failed: ${params.get("qb_error")}`);
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const seedMutation = trpc.admin.seedData.useMutation({
    onSuccess: () => toast.success("Default badges and rewards seeded successfully!"),
    onError: (err) => toast.error(err.message),
  });

  const [qrTarget, setQrTarget] = useState("/invoices");
  const [customPath, setCustomPath] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [generatingQr, setGeneratingQr] = useState(false);

  const generateQR = async (path: string) => {
    setGeneratingQr(true);
    try {
      const url = `${window.location.origin}${path}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: { dark: "#1B2A5E", light: "#FFFFFF" },
      });
      setQrDataUrl(dataUrl);
    } catch (e) {
      toast.error("Failed to generate QR code");
    } finally {
      setGeneratingQr(false);
    }
  };

  useEffect(() => {
    generateQR(qrTarget);
  }, [qrTarget]);

  const finalPath = customPath || qrTarget;

  return (
    <AdminLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h2 className="text-xl font-bold text-[#1B2A5E]">Settings</h2>
          <p className="text-sm text-gray-500">System configuration and tools</p>
        </div>

        {/* Tier Thresholds Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#EBF4FF] flex items-center justify-center">
              <Star size={18} className="text-[#1B2A5E]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1B2A5E]">Tier Thresholds</h3>
              <p className="text-xs text-gray-500">Lifetime points required for each tier</p>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { tier: "Bronze", points: "0+", color: "#CD7F32", bg: "#FDF4EC" },
              { tier: "Silver", points: "500+", color: "#94A3B8", bg: "#F1F5F9" },
              { tier: "Gold", points: "2,000+", color: "#F59E0B", bg: "#FFFBEB" },
              { tier: "Platinum", points: "5,000+", color: "#6366F1", bg: "#EEF2FF" },
            ].map(({ tier, points, color, bg }) => (
              <div key={tier} className="rounded-xl p-3 text-center" style={{ backgroundColor: bg }}>
                <div className="font-bold text-sm" style={{ color }}>{tier}</div>
                <div className="text-xs text-gray-500 mt-0.5">{points} pts</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-3">Tier thresholds are defined in the system. Contact your developer to adjust these values.</p>
        </div>

        {/* Points Rate Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#EBF4FF] flex items-center justify-center">
              <Settings size={18} className="text-[#1B2A5E]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1B2A5E]">Points Configuration</h3>
              <p className="text-xs text-gray-500">Current earning and expiry rules</p>
            </div>
          </div>
          <div className="space-y-3">
            {[
              { label: "Earning Rate", value: "1 point per 10 KWD spent" },
              { label: "Points Expiry", value: "365 days of inactivity" },
              { label: "Expiry Warning", value: "30 days before expiry" },
              { label: "Daily Spin Limit", value: "1 spin per customer per day" },
              { label: "Invoice Rate Limit", value: "5 invoices per customer per day" },
              { label: "Suspicious Amount", value: "Invoices over 50,000 KWD flagged" },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <span className="text-sm text-gray-600">{label}</span>
                <span className="text-sm font-semibold text-[#1B2A5E]">{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* QR Code Generator */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#EBF4FF] flex items-center justify-center">
              <QrCode size={18} className="text-[#1B2A5E]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1B2A5E]">QR Code Generator</h3>
              <p className="text-xs text-gray-500">Generate QR codes for invoices, campaigns, and referrals</p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
            {QR_PRESETS.map(({ label, path, icon }) => (
              <button
                key={path}
                onClick={() => { setQrTarget(path); setCustomPath(""); }}
                className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                  qrTarget === path && !customPath
                    ? "bg-[#1B2A5E] text-white border-[#1B2A5E]"
                    : "border-gray-200 text-gray-600 hover:border-[#5B9BD5] hover:text-[#1B2A5E]"
                }`}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>

          <div className="mb-4">
            <label className="text-xs text-gray-500 mb-1 block font-medium">Custom Path (optional)</label>
            <div className="flex gap-2">
              <input
                value={customPath}
                onChange={e => setCustomPath(e.target.value)}
                placeholder="/invoices?campaign=summer2026"
                className="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-[#5B9BD5]"
              />
              <button
                onClick={() => generateQR(customPath || qrTarget)}
                disabled={generatingQr}
                className="px-4 py-2.5 bg-[#5B9BD5] text-white rounded-xl text-sm font-semibold hover:opacity-90 flex items-center gap-2"
              >
                {generatingQr ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                Generate
              </button>
            </div>
          </div>

          {qrDataUrl && (
            <div className="flex flex-col items-center gap-3 p-4 bg-gray-50 rounded-xl">
              <div className="p-3 bg-white rounded-xl border-2 border-[#1B2A5E] shadow-sm">
                <img src={qrDataUrl} alt="QR Code" className="w-48 h-48" />
              </div>
              <p className="text-xs text-gray-500 text-center">
                Points to: <span className="font-mono text-[#1B2A5E]">{window.location.origin}{finalPath}</span>
              </p>
              <a
                href={qrDataUrl}
                download={`prime-rewards-qr-${finalPath.replace(/\//g, "-")}.png`}
                className="flex items-center gap-2 bg-[#1B2A5E] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90"
              >
                <Download size={14} />
                Download QR Code
              </a>
            </div>
          )}
        </div>

        {/* QuickBooks Integration */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
              <Link2 size={18} className="text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[#1B2A5E]">QuickBooks Integration</h3>
              <p className="text-xs text-gray-500">Automatic invoice validation and verification</p>
            </div>
            {!loadingQbStatus && (
              <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                qbStatus?.connected ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
              }`}>
                {qbStatus?.connected ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                {qbStatus?.connected ? "Connected" : "Not Connected"}
              </div>
            )}
          </div>

          {loadingQbStatus ? (
            <div className="flex justify-center py-4"><Loader2 size={20} className="animate-spin text-gray-400" /></div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Environment", value: qbStatus?.environment ?? "sandbox" },
                  { label: "Realm ID", value: qbStatus?.realmId ? `...${qbStatus.realmId.slice(-6)}` : "Not set" },
                  { label: "Status", value: qbStatus?.connected ? "Active" : "Disconnected" },
                  { label: "Connected", value: qbStatus?.connectedAt ? new Date(qbStatus.connectedAt).toLocaleDateString() : "Never" },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-400 mb-0.5">{label}</p>
                    <p className="text-sm font-semibold text-[#1B2A5E]">{value}</p>
                  </div>
                ))}
              </div>

              {/* Token expired warning */}
              {qbStatus?.connected && qbStatus?.tokenExpired && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <p className="text-sm font-semibold text-amber-700 mb-1">⚠ Token Expired</p>
                  <p className="text-xs text-amber-600 mb-3">Your QuickBooks authorization has expired (tokens last ~100 days). Re-authorize to restore invoice validation.</p>
                  <a href="/api/qb/connect" className="inline-flex items-center gap-2 bg-amber-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90">
                    <RefreshCw size={14} />
                    Re-authorize Now
                  </a>
                </div>
              )}

              {/* Invalid grant / refresh token error guidance */}
              {qbStatus?.connected && !qbStatus?.tokenExpired && (
                <div className="bg-green-50 rounded-xl p-3 text-sm text-green-700">
                  <p className="font-semibold mb-1">✓ QuickBooks is active</p>
                  <p className="text-xs text-green-600">Invoice numbers are automatically validated. Points are only awarded for paid invoices.</p>
                </div>
              )}

              {!qbStatus?.connected && (
                <div className="bg-yellow-50 rounded-xl p-3 text-sm text-yellow-700">
                  <p className="font-semibold mb-1">QuickBooks not connected</p>
                  <p className="text-xs text-yellow-600 mb-3">Without QuickBooks, invoices go to manual review. Connect to enable automatic validation.</p>
                  <a
                    href="/api/qb/connect"
                    className="inline-flex items-center gap-2 bg-[#1B2A5E] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90"
                  >
                    <ExternalLink size={14} />
                    Connect QuickBooks
                  </a>
                </div>
              )}

              {qbStatus?.connected && (
                <div className="flex gap-3 flex-wrap">
                  <a
                    href="/api/qb/connect"
                    className="inline-flex items-center gap-2 text-sm text-[#5B9BD5] hover:underline"
                  >
                    <RefreshCw size={13} />
                    Re-authorize QuickBooks
                  </a>
                  <button
                    onClick={async () => {
                      if (!confirm("Disconnect QuickBooks? Invoice validation will be disabled until you reconnect.")) return;
                      setDisconnectingQb(true);
                      try {
                        await fetch("/api/qb/disconnect", { method: "POST" });
                        const data = await fetch("/api/qb/status").then(r => r.json());
                        setQbStatus(data);
                        toast.success("QuickBooks disconnected.");
                      } catch {
                        toast.error("Failed to disconnect.");
                      } finally {
                        setDisconnectingQb(false);
                      }
                    }}
                    disabled={disconnectingQb}
                    className="inline-flex items-center gap-2 text-sm text-red-500 hover:underline disabled:opacity-50"
                  >
                    {disconnectingQb ? <Loader2 size={13} className="animate-spin" /> : null}
                    Disconnect
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Fraud & Security Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-red-50 flex items-center justify-center">
              <Shield size={18} className="text-red-500" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1B2A5E]">Fraud Protection</h3>
              <p className="text-xs text-gray-500">Active security measures</p>
            </div>
          </div>
          <div className="space-y-2">
            {[
              "Duplicate invoice number detection",
              "Rate limiting: max 5 invoices per customer per day",
              "Suspicious amount flagging (>50,000 KWD)",
              "Admin review queue for flagged activity",
              "All point adjustments logged with reason",
            ].map((item) => (
              <div key={item} className="flex items-center gap-2 text-sm text-gray-600">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                {item}
              </div>
            ))}
          </div>
        </div>

        {/* Seed Data */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-[#EBF4FF] flex items-center justify-center">
              <Database size={18} className="text-[#1B2A5E]" />
            </div>
            <div>
              <h3 className="font-semibold text-[#1B2A5E]">Seed Default Data</h3>
              <p className="text-xs text-gray-500">Populate badges and rewards with default values</p>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            This will add the default badge set (First Order, Loyal Customer, Big Spender, and others) and default rewards to the system. Safe to run multiple times — existing records are preserved.
          </p>
          <button
            onClick={() => seedMutation.mutate()}
            disabled={seedMutation.isPending}
            className="flex items-center gap-2 bg-[#1B2A5E] text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:opacity-90 disabled:opacity-50"
          >
            {seedMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Database size={14} />}
            Seed Default Badges & Rewards
          </button>
        </div>
      </div>
    </AdminLayout>
  );
}
