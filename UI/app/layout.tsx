import type { Metadata } from "next";
import "./globals.css";
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";

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
        <div className="app-layout">
          <Sidebar role="admin" />
          <div className="main-wrapper">
            <Header />
            <main className="main-content">{children}</main>
            <Footer />
          </div>
        </div>
      </body>
    </html>
  );
}