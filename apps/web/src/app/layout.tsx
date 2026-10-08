import type { Metadata } from "next";
import { Inter, Vazirmatn } from "next/font/google";
import { Providers } from "@/components/providers";
import { ThemeProvider } from "@/components/theme-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const vazirmatn = Vazirmatn({ subsets: ["arabic"], variable: "--font-arabic" });

export const metadata: Metadata = {
  title: "SchoolSphere ERP - School Management Platform",
  description:
    "Multi-tenant school management platform for schools, teachers, students, and parents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(inter.variable, vazirmatn.variable)}>
        <ThemeProvider attribute="class" defaultTheme="light">
          <Providers>{children}</Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}