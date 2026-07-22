import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import Navbar from "@/components/Navbar";
import { MockBanner } from "@/components/MockBanner";
import { Toasts } from "@/components/Toasts";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OMNI-GRAPH · Industrial Knowledge Intelligence",
  description:
    "Hybrid-Edge AI that maps engineering manuals and P&ID schematics into a unified 3D knowledge graph.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${inter.variable} ${jetbrains.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <Navbar />
          <MockBanner />
          <main className="flex-1 overflow-hidden relative">
            {children}
          </main>
          <Toasts />
        </ThemeProvider>
      </body>
    </html>
  );
}
