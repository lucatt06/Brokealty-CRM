import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brokealty CRM — CRM Inmobiliario",
  description: "Plataforma SaaS de CRM Vertical para Inmobiliarias con IA Nativa",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
