import type { Metadata } from "next";
import { descriptor, brandName } from "@vitalos/cms";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: brandName, template: `%s | ${brandName}` },
  description: descriptor,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-GB">
      <body>
        <a className="skip-link" href="#main">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
