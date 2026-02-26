import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Amico - Your AI Desktop Companion",
  description: "A companion that stays with you. Turn any photo into a living desktop presence.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
