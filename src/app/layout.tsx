import type { Metadata, Viewport } from "next";
import { Onest } from "next/font/google";
import "./globals.css";

const onest = Onest({ variable: "--font-onest", subsets: ["latin", "cyrillic"] });

export const metadata: Metadata = {
  title: "CRM",
  description: "Учёт заявок и воронки продаж",
  appleWebApp: { capable: true, title: "CRM", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#edf0ec",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className={`${onest.variable} h-full antialiased`}>
      <body className="h-full">{children}</body>
    </html>
  );
}
