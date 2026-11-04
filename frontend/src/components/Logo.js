// "Piknik Bingo" wordmark: sun over the Garut mountains + text. Colours match globals.css.
export function LogoMark({ className = "w-8 h-8" }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <circle cx="44" cy="19" r="11" fill="#ffc93c" />
      <path d="M2 54 L24 22 L46 54 Z" fill="#2ec4b6" />
      <path d="M24 22 L30.5 31.5 L27 34 L24 30 L20.5 34 L17.5 31.5 Z" fill="#ffffff" />
      <path d="M22 54 L42 30 L62 54 Z" fill="#ff9f43" />
      <rect x="2" y="52" width="60" height="4" rx="2" fill="#ff6b6b" />
    </svg>
  );
}

export default function Logo({ size = "sm" }) {
  if (size === "lg") {
    return (
      <div className="flex flex-col items-center">
        <LogoMark className="w-24 h-24" />
        <h1 className="text-5xl font-black tracking-tight leading-none mt-1 text-slate-800">
          Piknik <span className="text-orange-500">Bingo</span>
        </h1>
      </div>
    );
  }
  return (
    <span className="flex items-center gap-1.5">
      <LogoMark className="w-7 h-7" />
      <span className="font-black text-base text-slate-800">
        Piknik <span className="text-orange-500">Bingo</span>
      </span>
    </span>
  );
}
