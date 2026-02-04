import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Azul Online",
  description:
    "A faithful digital recreation of the Azul board game. Play with 2-4 players in real-time.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
