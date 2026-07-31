import type { Metadata } from "next";
import { Nunito_Sans, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const nunitoSans = Nunito_Sans({
  variable: "--font-prose",
  subsets: ["latin"],
  style: ["normal", "italic"],
  weight: ["400", "600"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-chrome",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Meanwhile",
  description: "A journal for two.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${nunitoSans.variable} ${plexSans.variable}`}>{children}</body>
    </html>
  );
}
