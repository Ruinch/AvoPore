import "@fontsource-variable/geist";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import "./globals.css";

const displayFont = localFont({
  src: [
    { path: "../../public/fonts/DMSerifText-Regular.ttf", weight: "400", style: "normal" },
    { path: "../../public/fonts/DMSerifText-Italic.ttf", weight: "400", style: "italic" },
  ],
  variable: "--font-display-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "AvoPore | Creative workshops near you", template: "%s | AvoPore" },
  description: "Book beginner-friendly creative workshops at independent US studios with one flexible membership.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en" className={displayFont.variable} data-scroll-behavior="smooth"><body>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <SiteHeader />
    <main id="main-content">{children}</main>
    <SiteFooter />
  </body></html>;
}
