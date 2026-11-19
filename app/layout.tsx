import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "./shell.css"; // must come after globals.css
import { Toaster } from "@/components/ui/sonner";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });
const display = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", axes: ["opsz"], display: "swap" });

export const metadata: Metadata = {
  title: "Rent and tenant management",
  description: "Managing buildings, tenants and M-Pesa rent payments.",
  robots: { index: false, follow: false }, // private admin app
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#183c32",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${display.variable}`}>
      <body className="antialiased">
        {children}
        <Toaster richColors closeButton />
      </body>
    </html>
  );
}
