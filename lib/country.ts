export type CountryOption = {
  code: string;
  name: string;
};

export const COUNTRY_LIST: CountryOption[] = [
  { code: "AE", name: "United Arab Emirates" },
  { code: "PK", name: "Pakistan" },
  { code: "SA", name: "Saudi Arabia" },
  { code: "IN", name: "India" },
  { code: "GB", name: "United Kingdom" },
  { code: "US", name: "United States" },
];

export const getCountryStorageKey = (userId: string) =>
  `dpw_country_selected_${userId}`;

export const getCountryCode = (name: string) =>
  COUNTRY_LIST.find((country) => country.name === name)?.code ?? "--";
