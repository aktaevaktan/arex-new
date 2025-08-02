import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Панель Администратора - Topex Logistics",
  description: "Управление Google Таблицами и рассылками в системе Topex Logistics",
  keywords: "Topex, Logistics, Администратор, Google Таблицы, Рассылка",
  robots: "noindex, nofollow",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
