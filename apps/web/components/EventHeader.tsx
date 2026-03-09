import { LiveIndicator } from './LiveIndicator';
import type { Event } from '../lib/types';

interface Props {
  event: Event;
}

export function EventHeader({ event }: Props) {
  return (
    <header className="relative px-6 pt-8 pb-6">
      {/* Background glow */}
      <div
        className="absolute inset-0 opacity-20 blur-3xl pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at 50% 0%, ${event.primaryColor ?? '#6366f1'} 0%, transparent 70%)`,
        }}
      />

      <div className="relative flex flex-col items-center gap-3 text-center">
        {/* Logo / branding */}
        {event.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={event.logoUrl} alt={event.name} className="h-14 object-contain" />
        ) : (
          <div className="text-4xl">🎶</div>
        )}

        <div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
            {event.name}
          </h1>
          {event.venue && (
            <p className="text-white/50 text-sm mt-0.5">{event.venue}</p>
          )}
        </div>

        <LiveIndicator totalListeners={event.totalListeners} />
      </div>
    </header>
  );
}
