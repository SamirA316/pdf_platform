import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QuickPDF - Every tool you need to work with PDFs",
  description: "Merge, split, compress, convert, rotate, unlock and watermark PDFs with just a few clicks. 100% Secure and fast.",
};

import { ReduxProvider } from "@/store/ReduxProvider";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="font-sans min-h-full flex flex-col">
        <ReduxProvider>
          {children}
        </ReduxProvider>
      </body>
    </html>
  );
}
