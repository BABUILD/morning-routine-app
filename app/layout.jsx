import "./globals.css";

export const metadata = {
  title: "Morning Base Routine",
  description: "毎朝のルーティーンを場所・時間帯ごとにチェックして習慣化を支援するWebアプリ",
  // PWA / mobile
  themeColor: "#0f172a",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "MBR",
  },
  // Open Graph — shown when shared via LINE/Twitter etc.
  openGraph: {
    title: "Morning Base Routine",
    description: "朝ルーティーン管理アプリ",
    type: "website",
  },
  // Viewport — critical for mobile layout
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,   // prevent iOS double-tap zoom on form elements
    userScalable: false,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <head>
        {/* PWA manifest — inline for zero-config Vercel deploy */}
        <link rel="manifest" href="/manifest.json" />
        {/* iOS home-screen icon placeholder — replace with your own 192×192 PNG */}
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
