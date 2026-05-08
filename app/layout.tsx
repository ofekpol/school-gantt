import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Gantt",
  description: "Multi-tenant school event calendar",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html dir="rtl" lang="he">
      <body className="min-h-screen bg-white text-neutral-900 antialiased">
        {children}
      </body>
    </html>
  );
}
