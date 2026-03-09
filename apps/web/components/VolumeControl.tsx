'use client';

import { usePlayerStore } from '../store/playerStore';

export function VolumeControl() {
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);

  const displayVol = isMuted ? 0 : volume;

  const icon =
    displayVol === 0 ? '🔇' : displayVol < 0.4 ? '🔈' : displayVol < 0.75 ? '🔉' : '🔊';

  return (
    <div className="flex items-center gap-3 w-full max-w-xs">
      <button
        onClick={toggleMute}
        aria-label={isMuted ? 'Unmute' : 'Mute'}
        className="text-xl shrink-0 opacity-80 hover:opacity-100 transition-opacity"
      >
        {icon}
      </button>

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={displayVol}
        onChange={(e) => setVolume(parseFloat(e.target.value))}
        aria-label="Volume"
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer accent-white"
        style={{
          background: `linear-gradient(to right, white ${displayVol * 100}%, rgba(255,255,255,0.2) ${displayVol * 100}%)`,
        }}
      />

      <span className="text-white/40 text-xs w-8 text-right tabular-nums">
        {Math.round(displayVol * 100)}
      </span>
    </div>
  );
}
