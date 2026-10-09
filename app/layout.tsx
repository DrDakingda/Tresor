import type { Metadata, Viewport } from "next";
import { Google_Sans_Flex } from "next/font/google";
import "./globals.css";

const sansFlex = Google_Sans_Flex({
  variable: "--font-sans-flex",
  subsets: ["latin"],
  // Next no tiene métricas de esta fuente para ajustar la de respaldo; se usa la del sistema.
  adjustFontFallback: false,
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "Tresor",
  description: "Cierres de caja y control financiero",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#f6f6f3",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${sansFlex.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
