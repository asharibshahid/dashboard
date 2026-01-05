import type { InputHTMLAttributes, ReactNode } from "react";

type SearchInputProps = {
  label: string;
  badge?: string;
  rightIcon?: ReactNode;
} & InputHTMLAttributes<HTMLInputElement>;

export default function SearchInput({
  label,
  badge,
  rightIcon,
  className,
  type = "text",
  ...props
}: SearchInputProps) {
  return (
    <label className="flex w-full flex-col gap-2 text-sm font-medium text-slate-700">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        {label}
      </span>
      <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <input
          type={type}
          className={`w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none ${
            className ?? ""
          }`}
          {...props}
        />
        {badge ? (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {badge}
          </span>
        ) : null}
        {rightIcon ? rightIcon : null}
      </div>
    </label>
  );
}
