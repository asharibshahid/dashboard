import type { VesselRow } from "../lib/loadVessels";

type VesselCardProps = {
  vessel: VesselRow;
};

export default function VesselCard({ vessel }: VesselCardProps) {
  return (
    <article className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
              Vessel Name
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {vessel.vesselName}
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">
            {vessel.terminal}
          </span>
        </div>
        <div className="grid gap-3 text-xs text-slate-600 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Vessel Type
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {vessel.vesselType}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Voyage No.
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {vessel.voyageNo}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Rotation
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {vessel.rotation}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Arrived From
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {vessel.arrivedFrom}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Sail To
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {vessel.sailTo}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Berth
            </p>
            <p className="text-sm font-semibold text-slate-900">{vessel.berth}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              E.T.A.
            </p>
            <p className="text-sm font-semibold text-slate-900">{vessel.eta}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              E.T.D.
            </p>
            <p className="text-sm font-semibold text-slate-900">{vessel.etd}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Cut-off date
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {vessel.cutoffDate}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}
