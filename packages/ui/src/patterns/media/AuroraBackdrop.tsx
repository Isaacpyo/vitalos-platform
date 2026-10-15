import { cx } from "../../primitives/_internal/cx";

export interface AuroraBackdropProps {
  className?: string | undefined;
}

/**
 * A slow aurora for a dark band (owner direction, 15 Oct 2026): three blurred light fields in
 * Vitalos Blue and Aqua drift under a faint grid that fades towards the edges. Decorative: hidden
 * from assistive technology. The drift loops (token CSS, "Ambient hero motion"), so the band must
 * be a `[data-motion-scope]` with a MotionPause switch (WCAG 2.2.2); under reduced motion the
 * fields stay still. Place it as the first child of a `relative isolate overflow-hidden` band.
 */
export function AuroraBackdrop({ className }: AuroraBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={cx("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <span className="hv-aurora-a absolute -top-1/3 -left-1/4 size-[42rem] rounded-full bg-blue-600/45 blur-[120px]" />
      <span className="hv-aurora-b absolute top-1/4 -right-1/4 size-[38rem] rounded-full bg-aqua-600/35 blur-[120px]" />
      <span className="hv-aurora-c absolute -bottom-1/3 left-1/3 size-[34rem] rounded-full bg-blue-700/40 blur-[110px]" />
      <span className="absolute inset-0 bg-[linear-gradient(rgb(255_255_255/0.05)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255/0.05)_1px,transparent_1px)] bg-[length:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" />
    </div>
  );
}
