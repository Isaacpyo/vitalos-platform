import { Icon } from "@vitalos/ui";

/**
 * The customer-funded delivery path, Discover, Prove, Build, Operate, then (only where justified)
 * productise. First-party markup, no client JavaScript. It sits beside DeliveryLoop (the
 * seven-step loop on the approach page), which it does not replace.
 */
const deliveryStages = [
  {
    name: "Discover",
    text: "Find the workflow worth improving, and decide whether AI is needed at all.",
    icon: "compass",
  },
  {
    name: "Prove",
    text: "Test the approach on your own authorised data, against measures agreed first.",
    icon: "flask",
  },
  {
    name: "Build",
    text: "Build it into your systems with the controls, tests and handover it needs.",
    icon: "code",
  },
  {
    name: "Operate",
    text: "Monitor, maintain and improve it as your data, models and process change.",
    icon: "gauge",
  },
] as const;

export function DeliveryStages() {
  return (
    <div className="flex flex-col gap-(--space-5)">
      <ol className="m-0 grid list-none gap-(--space-4) p-0 sm:grid-cols-2 lg:grid-cols-4">
        {deliveryStages.map((stage, index) => (
          <li
            key={stage.name}
            className="relative flex flex-col gap-(--space-3) rounded-xl border border-aid-border bg-aid-surface p-(--space-5) transition-[border-color,box-shadow] duration-(--duration-feedback) hover:border-aid-line hover:shadow-floating"
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex size-10 items-center justify-center rounded-md border border-aid-signal bg-aid-signal-soft text-aid-signal">
                <Icon name={stage.icon} size={20} />
              </span>
              <span className="font-mono text-small text-aid-muted">0{index + 1}</span>
            </div>
            <h3 className="m-0 text-h3 text-aid-heading">{stage.name}</h3>
            <p className="m-0 text-aid-text">{stage.text}</p>
            {index < deliveryStages.length - 1 ? (
              <span
                aria-hidden="true"
                className="absolute top-1/2 -right-3 z-10 hidden size-6 -translate-y-1/2 items-center justify-center rounded-full border border-aid-line/60 bg-aid-bg text-aid-muted lg:inline-flex"
              >
                <Icon name="chevron-right" size={16} />
              </span>
            ) : null}
          </li>
        ))}
      </ol>
      <div className="flex flex-col gap-(--space-2) rounded-xl border border-dashed border-aid-line/70 p-(--space-5) md:flex-row md:items-start md:gap-(--space-6)">
        <span className="inline-flex shrink-0 items-center gap-(--space-2) font-semibold text-aid-heading">
          <Icon name="layers" size={20} className="text-aid-signal" />
          Then, where it is justified: productise
        </span>
        <p className="m-0 text-aid-text">
          When the same solution proves useful for several customers, we may turn it into a
          repeatable product. That is a later step, taken only when the evidence supports it, and it
          never reuses your data.
        </p>
      </div>
    </div>
  );
}
