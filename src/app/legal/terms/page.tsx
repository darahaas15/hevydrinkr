'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function TermsPage() {
  const router = useRouter();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 active:text-white">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <h1 className="text-lg font-bold">Terms of Service</h1>
        </div>
      </div>

      <div className="px-5 py-6 max-w-lg mx-auto space-y-6 text-sm text-zinc-400 leading-relaxed">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Last updated: April 2026</p>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">1. Acceptance of Terms</h2>
          <p>By creating an account or using Drinkr, you agree to these Terms of Service. If you do not agree, do not use the app.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">2. Eligibility</h2>
          <p>You must be at least 18 years old (or the legal drinking age in your jurisdiction, whichever is higher) to use Drinkr. By using this app, you confirm that you meet this age requirement.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">3. Purpose & Disclaimer</h2>
          <p>Drinkr is a social tracking tool for informational and entertainment purposes only. It is not a medical device and does not provide medical advice. Any drink counts, statistics, or estimates shown are approximations and should not be relied upon for health, safety, or legal decisions.</p>
          <p className="mt-2">Drinkr does not encourage excessive or irresponsible alcohol consumption. Please drink responsibly and know your limits.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">4. User Conduct</h2>
          <p>You agree not to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li>Post content that is illegal, harmful, threatening, abusive, or harassing</li>
            <li>Encourage underage drinking or dangerous consumption</li>
            <li>Impersonate another person or misrepresent your identity</li>
            <li>Use the app for any unlawful purpose</li>
            <li>Upload content that infringes on the rights of others</li>
            <li>Attempt to interfere with or compromise the app&apos;s security</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">5. User-Generated Content</h2>
          <p>You are solely responsible for content you post. We reserve the right to remove any content that violates these terms or is reported as objectionable. By posting content, you grant Drinkr a non-exclusive license to display it within the app.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">6. Account Termination</h2>
          <p>We may suspend or terminate accounts that violate these terms. You may delete your account at any time through the Settings page.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">7. Limitation of Liability</h2>
          <p>Drinkr is provided &quot;as is&quot; without warranties. We are not liable for any damages arising from your use of the app, including but not limited to health consequences from alcohol consumption.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">8. Contact</h2>
          <p>For questions about these terms, contact us at <span className="text-accent">support@drinkr.app</span></p>
        </section>
      </div>
    </div>
  );
}
