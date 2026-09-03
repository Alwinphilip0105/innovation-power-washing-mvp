import type { Metadata, Viewport } from "next";
import { Archivo, Source_Sans_3 } from "next/font/google";

import { bootstrap } from "@/lib/bootstrap";
import { appUrl } from "@/lib/env";
import { innovationPowerWashing } from "@/lib/config/business";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  display: "swap",
});

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const business = innovationPowerWashing;

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: `${business.name} | Pressure Washing Services Pompton Lakes, NJ`,
    template: `%s | ${business.name}`,
  },
  description:
    "Innovative pressure washing for homes and businesses in Pompton Lakes, Wayne, and Pompton Wayne, NJ. Free estimates — text or call (973) 750-8757.",
  applicationName: business.name,
  authors: [{ name: business.name }],
  openGraph: {
    type: "website",
    siteName: business.name,
    locale: "en_US",
    url: appUrl,
    title: `${business.name} | Pressure Washing in Pompton Lakes, NJ`,
    description:
      "House washing, roofs, concrete, gutters, fences, windows, commercial work, painting and Christmas lights. Fully insured. Free quotes.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b2545",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  // Idempotent: wires the automation handlers for page-rendered requests.
  bootstrap();

  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${archivo.variable} ${sourceSans.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-surface text-body">{children}</body>
    </html>
  );
}
