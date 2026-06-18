import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Compounding Method — Med-Spa Growth Scanner",
  description: "Behind-the-Score growth + compliance scan for med spas.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
