import type { ButtonHTMLAttributes } from "react";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
};

export default function PrimaryButton({
  label,
  className,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-xl bg-[#e10600] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#c20500] focus:outline-none focus:ring-2 focus:ring-[#e10600]/40 ${
        className ?? ""
      }`}
      {...props}
    >
      {label}
    </button>
  );
}
