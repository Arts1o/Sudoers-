import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Edu-Agent — IA agentique pour l\'éducation',
  description: 'Base de hackathon : un agent IA au service de l\'éducation.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
