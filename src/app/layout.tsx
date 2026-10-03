import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "DataPermit — Good data. Clear permission.",
  description:
    "Discover and license specialist AI evaluation datasets. Passkey accounts and programmable access on Monad.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
