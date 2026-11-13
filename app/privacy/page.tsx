import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Tweve Tunnel",
  description: "Zero-logs privacy policy and data handling disclosures for Tweve Tunnel (com.ttunnel.vpn).",
};

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 px-5 py-12">
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between text-sm text-emerald-400">
          <Link href="/" className="hover:underline">
            &larr; Tweve Admin
          </Link>
          <span>com.ttunnel.vpn</span>
        </div>

        <header className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Tweve Tunnel Privacy Policy</h1>
          <p className="text-sm text-slate-400">
            Developer: MWL TweveOfficial Team &bull; Effective Date: November 13, 2026
          </p>
        </header>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-2">
          <h2 className="text-lg font-semibold text-emerald-400">1. Zero-Logs Commitment</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Tweve Tunnel does not log, monitor, or store your browsing history, visited websites, DNS queries, traffic destinations, or encrypted tunnel payloads.
          </p>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-2">
          <h2 className="text-lg font-semibold text-emerald-400">2. Android VpnService Usage</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Tweve Tunnel uses the Android VpnService API strictly to create an encrypted device-level tunnel between your device and your selected VPN/SSH/V2Ray server.
          </p>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-2">
          <h2 className="text-lg font-semibold text-emerald-400">3. Third-Party Services &amp; Data</h2>
          <ul className="list-disc pl-5 text-sm text-slate-300 space-y-1.5">
            <li><strong>Firebase</strong> (Realtime Database, Remote Config, Messaging, Analytics, Crashlytics) for server manifests, version checks, notifications, and crash diagnostics.</li>
            <li><strong>Unity Ads</strong> for rewarded and interstitial ads (may use Advertising ID / AD_ID).</li>
            <li><strong>Google Play Billing &amp; PressoPay</strong> for VIP upgrades; payment credentials are processed by the payment provider and never stored by Tweve Tunnel.</li>
            <li><strong>Local Configs &amp; HWID</strong> remain in private device storage; HWID is used for device-locked configs and VIP verification.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/70 p-6 space-y-2">
          <h2 className="text-lg font-semibold text-emerald-400">4. Data Deletion &amp; Contact</h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            To request deletion of any server-side HWID/subscription record or ask privacy questions, email{" "}
            <a href="mailto:tweveproject@gmail.com" className="text-emerald-400 underline">
              tweveproject@gmail.com
            </a>
            .
          </p>
        </section>
      </div>
    </main>
  );
}

