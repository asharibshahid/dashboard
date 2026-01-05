export type TabItem = {
  label: string;
  href: string;
};

export const tabs: TabItem[] = [
  { label: "Vessel Schedules", href: "/vessel-schedules" },
  { label: "Pots", href: "/pots" },
  { label: "Consumption", href: "/consumption" },
  { label: "Serves", href: "/serves-route" },
  { label: "Route", href: "/route" },
  { label: "B/L Tracking", href: "/bl-tracking" },
  { label: "Container Tracking", href: "/container-tracking" },
];
