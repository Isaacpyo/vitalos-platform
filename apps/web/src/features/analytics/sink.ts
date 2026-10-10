import type { Logger } from "@vitalos/observability";
import { analyticsEventSchemas, isAnalyticsEventName } from "./events";
import type { AnalyticsEventName, AnalyticsEventProperties } from "./events";

/**
 * Analytics sink contract. Only a no-op and a structured-log sink exist: no third-party script
 * or network call is made until the owner selects a provider and a consent approach (plan
 * section 6). A provider adapter later implements `AnalyticsSink` and is swapped in here.
 */
export interface AnalyticsSink {
  track<E extends AnalyticsEventName>(name: E, properties: AnalyticsEventProperties<E>): void;
}

export const noopAnalyticsSink: AnalyticsSink = { track() {} };

/**
 * Validates every event against the taxonomy before it reaches a sink. An invalid event is
 * dropped (analytics must never break a user journey) and reported through `onInvalid`.
 */
export function createValidatingSink(
  inner: AnalyticsSink,
  onInvalid?: (name: string, issueCount: number) => void,
): AnalyticsSink {
  return {
    track(name, properties) {
      // `name` is typed, but callers can be untyped JS or `never` casts: only own keys count.
      const schema = isAnalyticsEventName(String(name)) ? analyticsEventSchemas[name] : undefined;
      const result = schema?.safeParse(properties);
      if (!result?.success) {
        onInvalid?.(String(name), result?.error.issues.length ?? 1);
        return;
      }
      inner.track(name, result.data as AnalyticsEventProperties<typeof name>);
    },
  };
}

/** Records events as `analytics.event` log lines (debug aid and server-side fallback). */
export function createLoggerAnalyticsSink(logger: Logger): AnalyticsSink {
  return {
    track(name, properties) {
      logger.info("analytics.event", { analyticsEvent: name, ...properties });
    },
  };
}
