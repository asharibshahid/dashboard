"use client";

import { useEffect, useState } from "react";
import { SignIn, SignUp, SignedIn, SignedOut, useUser } from "@clerk/nextjs";
import {
  COUNTRY_LIST,
  getCountryStorageKey,
} from "../lib/country";

type AuthGateProps = {
  children: React.ReactNode;
};

export default function AuthGate({ children }: AuthGateProps) {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const { user, isLoaded } = useUser();
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [selectedCountry, setSelectedCountry] = useState("");

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }
    const key = getCountryStorageKey(user.id);
    const storedCountry =
      typeof window !== "undefined" ? window.localStorage.getItem(key) : null;
    if (storedCountry) {
      setSelectedCountry(storedCountry);
      setShowCountryModal(false);
      return;
    }
    setShowCountryModal(true);
  }, [isLoaded, user]);

  const confirmCountry = () => {
    if (!user || !selectedCountry) {
      return;
    }
    const key = getCountryStorageKey(user.id);
    window.localStorage.setItem(key, selectedCountry);
    setShowCountryModal(false);
  };

  return (
    <>
      <SignedIn>
        <div className="relative">
          {children}
          {showCountryModal ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#241B6A]/50 px-6">
              <div className="w-full max-w-[360px] rounded-3xl bg-white p-5 text-slate-900 shadow-[0_18px_40px_rgba(8,6,34,0.25)]">
                <h2 className="text-base font-semibold text-slate-900">
                  Select Country
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Choose your primary country to continue.
                </p>
                <label className="mt-4 flex w-full flex-col gap-2 text-sm font-medium text-slate-700">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                    Country
                  </span>
                  <select
                    value={selectedCountry}
                    onChange={(event) => setSelectedCountry(event.target.value)}
                    className="w-full appearance-none rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none"
                  >
                    <option value="">Select a country</option>
                    {COUNTRY_LIST.map((country) => (
                      <option key={country.code} value={country.name}>
                        {country.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={confirmCountry}
                  className="mt-4 w-full rounded-xl bg-[#241B6A] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1c1554] focus:outline-none focus:ring-2 focus:ring-[#241B6A]/40 disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={!selectedCountry}
                >
                  Confirm
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </SignedIn>
      <SignedOut>
        <div className="rounded-[26px] bg-white p-5 text-slate-900 shadow-[0_18px_40px_rgba(8,6,34,0.25)]">
          <div className="mb-4 flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => setMode("signIn")}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                mode === "signIn"
                  ? "bg-[#241B6A] text-white"
                  : "border border-slate-200 text-slate-500"
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setMode("signUp")}
              className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] ${
                mode === "signUp"
                  ? "bg-[#241B6A] text-white"
                  : "border border-slate-200 text-slate-500"
              }`}
            >
              Sign Up
            </button>
          </div>
          <div className="flex justify-center">
            {mode === "signIn" ? (
              <SignIn routing="hash" />
            ) : (
              <SignUp routing="hash" />
            )}
          </div>
        </div>
      </SignedOut>
    </>
  );
}
