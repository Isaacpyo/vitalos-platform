"use client";

import { useEffect } from "react";
import type { AnalyticsEventName, AnalyticsEventProperties } from "../../features/analytics/events";
import { track } from "../../features/analytics/track";

/**
 * Records one analytics event when the page mounts, for example an accepted enquiry on the
 * receipt page. A no-op unless analytics is switched on. Renders nothing.
 */
export function TrackOnMount<E extends AnalyticsEventName>({
  name,
  properties,
}: Readonly<{ name: E; properties: AnalyticsEventProperties<E> }>) {
  useEffect(() => {
    track(name, properties);
    // Once per page view: the event and its properties are fixed for the page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}
