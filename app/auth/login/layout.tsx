import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Вход в систему - Arex Logistics",
  description: "Авторизация в административной панели Arex Logistics",
  keywords: "Arex, Logistics, Вход, Авторизация, Логин",
  robots: "noindex, nofollow",
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
