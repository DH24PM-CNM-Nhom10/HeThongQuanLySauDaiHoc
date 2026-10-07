// UI/app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import AuthGuard from "../components/AuthGuard";

export const metadata: Metadata = {
  title: "Hệ thống Quản lý Đào tạo Thạc sĩ | AGU",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi">
      <body>
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}