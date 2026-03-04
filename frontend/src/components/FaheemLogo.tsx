/**
 * Faheem Math logo — a √ radical sign on an emerald gradient square.
 * Clean, mathematical, instantly recognizable at any size.
 */
export default function FaheemLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Faheem Math"
      role="img"
    >
      <defs>
        <linearGradient
          id="faheem-bg"
          x1="0"
          y1="0"
          x2="36"
          y2="36"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#34d399" />
          <stop offset="1" stopColor="#059669" />
        </linearGradient>
      </defs>
      <rect width="36" height="36" rx="9" fill="url(#faheem-bg)" />
      {/* √ radical sign */}
      <path
        d="M8 19.5 L12 19.5 L16 28 L28 8"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
