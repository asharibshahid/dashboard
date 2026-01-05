import { assets } from "./assets";

export type HomeTile = {
  title: string;
  subtitle?: string;
  href: string;
  bgClass: string;
  shadowClass: string;
  iconSrc?: string;
  iconAlt?: string;
};

export const homeTiles: HomeTile[] = [
  {
    title: "Vessel Schedules",
    subtitle: "Live ETA + ETD",
    href: "/vessel-schedules",
    bgClass: "bg-[#1f6fff]",
    shadowClass: "shadow-[0_16px_35px_rgba(31,111,255,0.35)]",
  },
  {
    title: "Pots Consumption",
    href: "/pots",
    bgClass: "bg-[#f28c28]",
    shadowClass: "shadow-[0_16px_35px_rgba(242,140,40,0.35)]",
    iconSrc: assets.icons.crane,
    iconAlt: "Crane",
  },
  {
    title: "Serves Route",
    href: "/serves-route",
    bgClass: "bg-[#ff5b8a]",
    shadowClass: "shadow-[0_16px_35px_rgba(255,91,138,0.35)]",
    iconSrc: assets.icons.ship,
    iconAlt: "Ship",
  },
  {
    title: "B/L Tracking",
    subtitle: "Container Tracking",
    href: "/coming-soon",
    bgClass: "bg-[#8e95a8]",
    shadowClass: "shadow-[0_16px_35px_rgba(142,149,168,0.35)]",
    iconSrc: assets.icons.container,
    iconAlt: "Container",
  },
];
