"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import {
  COUNTRY_LIST,
  getCountryCode,
  getCountryStorageKey,
} from "../lib/country";

export default function CountrySelector() {
  const { user, isLoaded } = useUser();
  const [selectedCountry, setSelectedCountry] = useState("");

  useEffect(() => {
    if (!isLoaded || !user) {
      return;
    }
    const key = getCountryStorageKey(user.id);
    const storedCountry = window.localStorage.getItem(key);
    if (storedCountry) {
      setSelectedCountry(storedCountry);
    }
  }, [isLoaded, user]);

  if (!isLoaded || !user) {
    return <div className="h-10 w-10" />;
  }

  const handleChange = (value: string) => {
    setSelectedCountry(value);
    const key = getCountryStorageKey(user.id);
    window.localStorage.setItem(key, value);
  };

  return (
    <div className="flex items-center justify-end">
      <label className="rounded-full border border-white/20 bg-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white">
        <span className="sr-only">Country</span>
        <select
          value={selectedCountry}
          onChange={(event) => handleChange(event.target.value)}
          className="bg-transparent text-white focus:outline-none"
        >
          <option value="" className="text-slate-900">
            --
          </option>
          {COUNTRY_LIST.map((country) => (
            <option
              key={country.code}
              value={country.name}
              className="text-slate-900"
            >
              {getCountryCode(country.name)} - {country.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
