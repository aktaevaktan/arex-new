import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход в систему - Topex Logistics",
  description: "Авторизация в административной панели Topex Logistics",
  keywords: "Topex, Logistics, Вход, Авторизация, Логин",
  robots: "noindex, nofollow",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
