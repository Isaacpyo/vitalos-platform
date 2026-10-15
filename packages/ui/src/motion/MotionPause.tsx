import { cx } from "../primitives/_internal/cx";
import { Icon } from "../primitives/Icon";

export interface MotionPauseProps {
  /** Accessible name of the switch, for example "Pause background motion". */
  label: string;
  className?: string | undefined;
}

/**
 * The pause switch for looping decorative motion (WCAG 2.2.2). A native checkbox, so it works
 * without JavaScript: while it is checked, every animation inside the nearest
 * `[data-motion-scope]` is held (token CSS, "Ambient hero motion"). Hidden under reduced motion,
 * where nothing in the scope moves.
 */
export function MotionPause({ label, className }: MotionPauseProps) {
  return (
    <label
      className={cx(
        "inline-flex size-11 cursor-pointer items-center justify-center rounded-full border border-tone-border bg-tone-bg/50 text-tone-heading backdrop-blur-sm",
        "transition-colors duration-(--duration-feedback) ease-(--ease-standard) hover:border-tone-heading motion-reduce:hidden",
        className,
      )}
    >
      <input type="checkbox" data-motion-pause="" className="peer sr-only" />
      <span className="sr-only">{label}</span>
      <Icon name="pause" size={16} className="peer-checked:hidden" />
      <Icon name="play" size={16} className="hidden peer-checked:block" />
    </label>
  );
}
