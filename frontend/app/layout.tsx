import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Manrope } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const display = Manrope({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "HireMatch AI",
  description:
    "AI-powered resume intelligence, semantic job matching, and recruitment SaaS.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${sans.variable} ${display.variable} font-sans antialiased`}>
        {children}
      </body>
    </html>
  );
}
