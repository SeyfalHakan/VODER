import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Учет воды",
    template: "%s | Учет воды"
  },
  description: "Мобильная система учета продаж, склада, кассы, брака, павильонов и кулеров.",
  manifest: "/manifest.json",
  applicationName: "Учет воды",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Учет воды"
  },
  formatDetection: {
    telephone: false
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0f9f9c"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>{children}</body>
    </html>
  );
}
