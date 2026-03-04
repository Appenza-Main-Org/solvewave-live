/**
 * Faheem Math Logo - A creative, smart icon that represents 
 * both mathematics and the "Live AI" nature of the app.
 * 
 * Design: A stylized 'F' formed by a radical (square root) symbol, 
 * integrated with a pulse/waveform representing the "Live" voice aspect.
 */
export default function FaheemLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Faheem Math"
      role="img"
    >
      <defs>
        <linearGradient
          id="logo-gradient"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#10b981" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
        
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background Squircle */}
      <rect 
        width="40" 
        height="40" 
        rx="12" 
        fill="url(#logo-gradient)" 
        className="drop-shadow-lg"
      />

      {/* Smart Path: Radical sign that flows into an 'F' and a waveform */}
      <path
        d="M10 22L14 22L18 30L26 12H32M22 20H28"
        stroke="white"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        filter="url(#glow)"
      />

      {/* Live AI Pulse Dots */}
      <circle cx="32" cy="12" r="2.5" fill="white" className="animate-pulse">
        <animate
          attributeName="opacity"
          values="1;0.4;1"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
      
      {/* Decorative 'Spark' of intelligence */}
      <path
        d="M30 28L32 30M34 26L32 30M32 32L32 30M28 30H32"
        stroke="white"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity="0.6"
      />
    </svg>
  );
}
