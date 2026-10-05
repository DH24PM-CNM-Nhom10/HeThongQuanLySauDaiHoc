import type { Metadata } from "next";
import "./globals.css";
<<<<<<< HEAD
import Sidebar from "../components/Sidebar";
import Header from "../components/Header";
import Footer from "../components/Footer";
=======
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
>>>>>>> 10511a5b95d46554e53b0758e41ce6996e024e6d

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
<<<<<<< HEAD
}
=======
}
>>>>>>> 10511a5b95d46554e53b0758e41ce6996e024e6d
