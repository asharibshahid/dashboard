export type Vessel = {
  name: string;
  type: string;
  rotation: string;
  arrivedFrom: string;
  eta: string;
  berth: string;
  etd: string;
  cutoffDate: string;
};

export const vessels: Vessel[] = [
  {
    name: "DPW Horizon",
    type: "Container Vessel",
    rotation: "ME2-07",
    arrivedFrom: "Port of Jebel Ali",
    eta: "Apr 14, 06:30",
    berth: "B12",
    etd: "Apr 15, 22:00",
    cutoffDate: "Apr 13, 18:00",
  },
  {
    name: "Ocean Crest",
    type: "Ro-Ro",
    rotation: "EA1-19",
    arrivedFrom: "Port of Karachi",
    eta: "Apr 16, 09:15",
    berth: "C04",
    etd: "Apr 17, 20:45",
    cutoffDate: "Apr 15, 12:00",
  },
  {
    name: "Northern Star",
    type: "Feeder",
    rotation: "SEA-05",
    arrivedFrom: "Port of Colombo",
    eta: "Apr 18, 05:00",
    berth: "A02",
    etd: "Apr 18, 18:30",
    cutoffDate: "Apr 17, 16:00",
  },
];
