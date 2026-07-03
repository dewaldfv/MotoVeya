export default function LogoMark({ size = 96, className = '' }) {
  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="motogo-logo-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="hsl(26, 100%, 56%)" />
          <stop offset="100%" stopColor="hsl(20, 100%, 46%)" />
        </linearGradient>
      </defs>
      <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#motogo-logo-grad)" />
      {/* Navigation arrow body */}
      <path d="M60 26 L84 74 L60 64 L36 74 Z" fill="white" />
      {/* Wheels */}
      <circle cx="38" cy="86" r="9" stroke="white" strokeWidth="4.5" fill="none" />
      <circle cx="82" cy="86" r="9" stroke="white" strokeWidth="4.5" fill="none" />
    </svg>
  );
}