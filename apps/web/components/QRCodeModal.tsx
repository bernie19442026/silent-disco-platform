// /Users/bernie/silent-disco-platform/apps/web/components/QRCodeModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';

interface Props {
  url?: string;
}

export function QRCodeButton({ url }: Props) {
  const [open, setOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const modalRef = useRef<HTMLDivElement>(null);

  const targetUrl = url ?? (typeof window !== 'undefined' ? window.location.href : '');

  useEffect(() => {
    if (!open || !targetUrl) return;

    // Dynamically import qrcode to avoid SSR issues
    import('qrcode').then((QRCode) => {
      QRCode.toDataURL(targetUrl, {
        width: 256,
        margin: 2,
        color: {
          dark: '#ffffff',
          light: '#08090e',
        },
      }).then((url) => setQrDataUrl(url));
    });
  }, [open, targetUrl]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-white/40 hover:text-white/70 transition text-xs flex items-center gap-1.5"
        title="Share via QR Code"
        aria-label="Open QR code"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="3" height="3" />
          <rect x="19" y="14" width="2" height="2" />
          <rect x="14" y="19" width="2" height="2" />
          <rect x="18" y="19" width="3" height="3" />
        </svg>
        QR Code
      </button>

      {open && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div
            ref={modalRef}
            className="bg-[#0f1018] border border-white/15 rounded-2xl p-6 text-center max-w-xs w-full"
          >
            <h2 className="text-lg font-bold text-white mb-1">Join Signal Disco</h2>
            <p className="text-white/40 text-xs mb-5">Scan to listen on your phone</p>

            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt="QR code to join Signal Disco"
                className="w-48 h-48 mx-auto rounded-xl"
              />
            ) : (
              <div className="w-48 h-48 mx-auto rounded-xl bg-white/5 animate-pulse" />
            )}

            <p className="text-white/30 text-xs mt-4 break-all">{targetUrl}</p>

            <button
              onClick={() => setOpen(false)}
              className="mt-5 text-white/50 hover:text-white text-sm transition"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
