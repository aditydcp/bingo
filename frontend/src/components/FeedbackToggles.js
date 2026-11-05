import { useEffect, useState } from "react";
import { canVibrate } from "../lib/feedback";

// Round on/off buttons for sound effects, vibration (only where supported) and music
export default function FeedbackToggles({ settings, toggle }) {
  const [vibrationSupported, setVibrationSupported] = useState(false);
  useEffect(() => setVibrationSupported(canVibrate()), []);

  const buttons = [
    { name: "sound", icon: "🔊", label: "Suara" },
    vibrationSupported && { name: "vibration", icon: "📳", label: "Getar" },
    { name: "music", icon: "🎵", label: "Musik" },
  ].filter(Boolean);

  return (
    <div className="flex gap-1.5">
      {buttons.map((b) => {
        const on = settings[b.name];
        return (
          <button
            key={b.name}
            onClick={() => toggle(b.name)}
            aria-pressed={on}
            title={`${b.label}: ${on ? "nyala" : "mati"}`}
            className={`toggle-chip ${on ? "on" : "off"}`}
          >
            <span aria-hidden="true">{b.icon}</span>
            <span className="text-[10px] font-extrabold">{b.label}</span>
          </button>
        );
      })}
    </div>
  );
}
