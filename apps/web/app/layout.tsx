import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "Real-Time Chat",
  description: "Project 4 — Real-Time Chat Application",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
