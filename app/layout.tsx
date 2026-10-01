import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "旅行團快篩",
  description: "跨旅行社搜尋國外團體旅遊，快速篩選日期、天數與團費。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body className="antialiased">{children}</body>
    </html>
  );
}
