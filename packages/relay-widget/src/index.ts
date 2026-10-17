/**
 * @vitalos/relay-widget: the Vitalos Relay launcher (tiny, mounted on every page) and its lazily
 * loaded panel. Browser code only: it talks to /api/relay/* and imports nothing server-side.
 */
export { RelayLauncher } from "./launcher";
export type { RelayLauncherProps } from "./launcher";
export { RELAY_EVENT } from "./events";
export type { RelayEventDetail, RelayEventType } from "./events";
