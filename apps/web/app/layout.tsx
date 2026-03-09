import type { Metadata, Viewport } from 'next';
import './globals.css';

const APP_NAME = process.env.NEXT_PUBLIC_EVENT_NAME ?? 'Silent Disco';

export const metadata: Metadata = {
  title: APP_NAME,
  description: 'Live multi-channel audio streaming',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_NAME,
  },
};

export const viewport: Viewport = {
  themeColor: '#08090e',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Preconnect to streaming server */}
        {process.env.NEXT_PUBLIC_STREAMING_BASE_URL && (
          <link
            rel="preconnect"
            href={process.env.NEXT_PUBLIC_STREAMING_BASE_URL}
          />
        )}
      </head>
      <body>{children}</body>
    </html>
  );
}
