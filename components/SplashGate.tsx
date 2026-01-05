"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type SplashGateProps = {
  children: React.ReactNode;
};

const SPLASH_DURATION_MS = 3000;
export default function SplashGate({ children }: SplashGateProps) {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, SPLASH_DURATION_MS);

    return () => clearTimeout(timer);
  }, []);

  if (showSplash) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#241B6A] px-6">
        <div className="splash-logo">
          <div className="relative h-20 w-52 splash-logo-glow">
            <Image
              src="/brand/dpworld.png"
              alt="DP World"
              fill
              className="object-contain"
              priority
            />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
