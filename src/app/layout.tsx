import type { Metadata } from "next";
import Layout from "@/components/Layout";
import "./globals.css";

export const metadata: Metadata = {
  title: "BlindPulse — Anonymous Feedback on Midnight",
  description:
    "Anonymous feedback & surveys with verifiable participation on the Midnight blockchain via ZK proofs.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <div className="starfield" aria-hidden="true" />
        <div className="relative z-10">
          <Layout>{children}</Layout>
        </div>
      </body>
    </html>
  );
}
