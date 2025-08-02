import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ClientProvider } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arex Logistics - Панель Администратора",
  description:
    "Административная панель для управления системой Arex Logistics",
  keywords: "Arex, Logistics, Логистика, Администратор, Панель управления",
  authors: [{ name: "Arex Logistics" }],
  robots: "noindex, nofollow", // Private admin panel
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/logo.svg" type="image/svg+xml" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ClientProvider
          fontFamily={geistSans.style.fontFamily}
          monoFontFamily={geistMono.style.fontFamily}
        >
          {children}
        </ClientProvider>
      </body>
    </html>
  );
}
