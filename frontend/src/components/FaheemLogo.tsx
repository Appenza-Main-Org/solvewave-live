/**
 * SolveWave Logo — A premium icon representing live math tutoring.
 *
 * Design: A stylized wave pulse forming an 'S' shape with a subtle
 * math radical cue, on a deep dark rounded square. Cyan/emerald gradient
 * accent for the wave stroke. Conveys: math + live voice + intelligence.
 */
export default function FaheemLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="SolveWave"
      role="img"
    >
      <defs>
        <linearGradient
          id="sw-bg"
          x1="0"
          y1="0"
          x2="40"
          y2="40"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#0a0f1a" />
          <stop offset="1" stopColor="#0d1527" />
        </linearGradient>

        <linearGradient
          id="sw-wave"
          x1="6"
          y1="20"
          x2="34"
          y2="20"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#06b6d4" />
          <stop offset="0.5" stopColor="#10B981" />
          <stop offset="1" stopColor="#06b6d4" />
        </linearGradient>

        <filter id="sw-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="2.5" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Background — deep dark rounded square */}
      <rect
        width="40"
        height="40"
        rx="11"
        fill="url(#sw-bg)"
        stroke="#10B981"
        strokeWidth="0.5"
        strokeOpacity="0.3"
      />

      {/* Wave pulse forming S-curve — the SolveWave mark */}
      <path
        d="M8 24C12 24 13 14 20 14C27 14 28 26 32 26"
        stroke="url(#sw-wave)"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
        filter="url(#sw-glow)"
      />

      {/* Subtle radical / sqrt cue at left */}
      <path
        d="M8 17L10 17L12.5 24"
        stroke="#06b6d4"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.5"
      />

      {/* Live pulse dot */}
      <circle cx="33" cy="26" r="2" fill="#10B981">
        <animate
          attributeName="opacity"
          values="1;0.3;1"
          dur="2s"
          repeatCount="indefinite"
        />
      </circle>
    </svg>
  );
}
