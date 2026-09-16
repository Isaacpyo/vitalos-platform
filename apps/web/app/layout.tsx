import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: { default: "Vitalos", template: "%s | Vitalos" },
  description: "Technology Consulting, Engineering & Digital Transformation",
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
