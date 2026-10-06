import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "JOOLO — Your next chapter starts here",
  description:
    "A little space to grow, one intentional day at a time. Begin your JOOLO 40-day challenge.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
