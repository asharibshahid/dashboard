import CountrySelector from "./CountrySelector";

type MobileHeaderProps = {
  title?: string;
};

export default function MobileHeader({ title }: MobileHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <button
        type="button"
        aria-label="Open menu"
        className="rounded-full border border-white/15 bg-white/10 p-2 text-white"
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4 7H20M4 12H20M4 17H20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <span className="text-base font-semibold text-white">
        {title ?? "DP World"}
      </span>
      <CountrySelector />
    </div>
  );
}
