'use client';

import { ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="sticky top-0 z-20 safe-top" style={{ background: 'rgba(9,9,11,0.82)', backdropFilter: 'blur(28px) saturate(180%)', WebkitBackdropFilter: 'blur(28px) saturate(180%)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-5 py-3 flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 -ml-2 active:text-white">
            <ChevronLeft className="w-6 h-6 text-zinc-400" />
          </button>
          <h1 className="text-lg font-bold">Privacy Policy</h1>
        </div>
      </div>

      <div className="px-5 py-6 max-w-lg mx-auto space-y-6 text-sm text-zinc-400 leading-relaxed">
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider">Last updated: April 2026</p>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">1. Information We Collect</h2>
          <p>When you use Drinkr, we collect:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li><strong className="text-zinc-400">Account information:</strong> email address, username, display name, date of birth (used to verify you meet the minimum age)</li>
            <li><strong className="text-zinc-400">Profile data:</strong> avatar photo, bio, gender, height, and weight (used only on your own device to estimate your BAC)</li>
            <li><strong className="text-zinc-400">Session data:</strong> drink entries, venues (user-entered text), session times, photos you choose to upload</li>
            <li><strong className="text-zinc-400">Social data:</strong> follows, likes, comments, group memberships</li>
            <li><strong className="text-zinc-400">Device data:</strong> push notification tokens for delivering notifications</li>
          </ul>
          <p className="mt-2">Your gender, weight, height, and date of birth are visible only to you. They are never shown on your public profile.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">2. How We Use Your Information</h2>
          <p>We use your data to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li>Provide and operate the app&apos;s features</li>
            <li>Display your profile and activity to other users</li>
            <li>Send push notifications you have opted into</li>
            <li>Generate aggregate statistics (leaderboards, personal records)</li>
          </ul>
          <p className="mt-2">We do not sell your personal data to third parties.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">3. Data Storage & Security</h2>
          <p>Your data is stored securely using Supabase (hosted on AWS). We use row-level security policies to ensure users can only modify their own data. All data is transmitted over HTTPS.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">4. Data Sharing & Visibility</h2>
          <p>If your account is public, your sessions, posts, profile bio, and social interactions are visible to other authenticated Drinkr users. If your account is private, only approved followers can see your sessions and posts; non-followers see only your username, display name, and avatar.</p>
          <p className="mt-2">We do not share your data with third-party advertisers or analytics services.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">5. Your Rights</h2>
          <p>You have the right to:</p>
          <ul className="list-disc list-inside mt-2 space-y-1 text-zinc-500">
            <li><strong className="text-zinc-400">Access</strong> your personal data through your profile and session history</li>
            <li><strong className="text-zinc-400">Correct</strong> your data through the Settings page</li>
            <li><strong className="text-zinc-400">Delete</strong> your account and all associated data through Settings &gt; Delete Account</li>
            <li><strong className="text-zinc-400">Withdraw consent</strong> for push notifications at any time through Settings</li>
          </ul>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">6. Data Retention</h2>
          <p>We retain your data for as long as your account is active. When you delete your account, all associated data (sessions, posts, photos, follows, comments) is permanently deleted.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">7. Age Requirement</h2>
          <p>Drinkr is restricted to users who meet the legal drinking age in their jurisdiction (and at minimum 18 years of age). We verify your date of birth at signup and will terminate any account we discover does not meet this requirement.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">8. Reporting & Blocking</h2>
          <p>You can report posts, comments, or users that violate our community standards through the in-app menu, and you can block users to prevent them from seeing or engaging with your content. Reports are reviewed by our team.</p>
        </section>

        <section>
          <h2 className="text-base font-semibold text-white mb-2">9. Contact</h2>
          <p>For privacy-related questions or data requests, contact us at <span className="text-accent">privacy@drinkr.app</span></p>
        </section>
      </div>
    </div>
  );
}
