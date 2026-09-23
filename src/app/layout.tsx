import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeController } from "@/components/theme/theme-controller";
import { themeInitScript } from "@/lib/theme";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Drinkr",
  description: "Track your party sessions like a pro",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Drinkr",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  // `theme-color` is intentionally NOT set here: it is rendered as a plain
  // <meta> in <head> below (defaulting to dark) and updated at runtime by the
  // anti-FOUC script + ThemeController so it tracks the active theme.
  // Make the layout viewport shrink when the soft keyboard opens, so
  // `position: fixed; bottom: 0` and `100dvh` follow the keyboard natively
  // and in sync with the system animation. iOS Safari 16.4+ / Chrome 108+.
  interactiveWidget: "resizes-content",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* Default (dark) theme-color; the anti-FOUC script and ThemeController
            update its content to match the active theme. Declared before the
            script so the script can find and update it. */}
        <meta name="theme-color" content="#09090b" suppressHydrationWarning />
        {/* Blocking: set data-theme before first paint to avoid a flash of the
            wrong theme. Mirrors useThemeStore's persisted key/shape. */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript() }} />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="preconnect" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
        <link rel="dns-prefetch" href={process.env.NEXT_PUBLIC_SUPABASE_URL} />
      </head>
      <body className="bg-background text-foreground antialiased">
        <ThemeController />
        {children}
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}

function ServiceWorkerRegistrar() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              // The first install also fires updatefound (and sw.js claims the
              // page on activate), so only a worker that replaces an existing
              // one is an update worth announcing.
              var hadWorker = !!navigator.serviceWorker.controller;
              navigator.serviceWorker.register('/sw.js').then(function(reg) {
                // Check for updates every 30 minutes
                setInterval(function() { reg.update(); }, 30 * 60 * 1000);

                // When a new SW is installed, prompt user to reload
                reg.addEventListener('updatefound', function() {
                  var newSW = reg.installing;
                  if (!newSW) return;
                  newSW.addEventListener('statechange', function() {
                    if (newSW.state === 'activated' && hadWorker) {
                      // New version available — show a non-intrusive banner
                      var banner = document.createElement('div');
                      banner.setAttribute('style',
                        'position:fixed;top:0;left:0;right:0;z-index:9999;' +
                        'background:linear-gradient(135deg,#14b8a6,#06b6d4);' +
                        'color:#fff;text-align:center;padding:12px 16px;font-size:14px;' +
                        'font-family:system-ui,sans-serif;cursor:pointer;' +
                        'padding-top:calc(12px + env(safe-area-inset-top,0px))'
                      );
                      banner.textContent = 'A new version is available. Tap to update.';
                      banner.onclick = function() { window.location.reload(); };
                      document.body.appendChild(banner);
                    }
                    if (newSW.state === 'activated') hadWorker = true;
                  });
                });
              });
            });
          }
        `,
      }}
    />
  );
}
