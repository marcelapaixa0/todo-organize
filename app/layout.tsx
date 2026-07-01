import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SwRegister from "@/components/sw-register";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ToDo Organize",
  description: "Organize as tarefas e agenda da sua família",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ToDo Organize",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#6366f1",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={inter.className}>
        <SwRegister />
        {children}
      </body>
    </html>
  );
}
