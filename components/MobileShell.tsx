import type { ReactNode } from "react";

type MobileShellProps = {
  children: ReactNode;
};

export default function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="min-h-screen bg-[#241B6A] px-4 py-6 text-white">
      <div className="mx-auto flex min-h-[100vh] w-full max-w-[420px] flex-col rounded-[24px] border border-white/10 bg-[#241B6A] shadow-[0_24px_60px_rgba(10,6,36,0.55)]">
        <div className="flex-1 px-6 pb-10 pt-6">{children}</div>
      </div>
    </div>
  );
}
