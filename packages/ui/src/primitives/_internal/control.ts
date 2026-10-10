/** Shared control surface: 3:1 boundary, 48px target, error state via border and aria-invalid. */
export const controlClasses =
  "block w-full min-h-(--size-control) rounded-sm border border-tone-control-border bg-tone-control-bg " +
  "px-(--space-3) py-(--space-2) text-body text-tone-text placeholder:text-tone-muted " +
  "transition-colors duration-(--duration-feedback) ease-(--ease-standard) " +
  "aria-invalid:border-2 aria-invalid:border-danger " +
  "disabled:cursor-not-allowed disabled:border-tone-border disabled:bg-tone-bg disabled:text-tone-muted";
