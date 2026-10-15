/**
 * Cloudflare Turnstile, loaded only when a conversation is created (never on page load). The
 * widget runs invisibly with action "relay"; the token is verified server-side.
 */
interface TurnstileApi {
  render(el: HTMLElement, opts: Record<string, unknown>): string;
  execute(widgetId: string): void;
  reset(widgetId: string): void;
}

/** The site declares its own `window.turnstile` type; read it through a local view instead. */
const win = () => window as unknown as { turnstile?: TurnstileApi };

const SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let loading: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  const existing = win().turnstile;
  if (existing) return Promise.resolve(existing);
  return (loading ??= new Promise<TurnstileApi>((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT;
    s.async = true;
    s.onload = () => {
      const api = win().turnstile;
      if (api) resolve(api);
      else reject(new Error("turnstile"));
    };
    s.onerror = () => {
      loading = null;
      reject(new Error("turnstile"));
    };
    document.head.appendChild(s);
  }));
}

let widgetId: string | null = null;
let pending: ((token: string | undefined) => void) | null = null;

/** Resolves a fresh token, or undefined when Turnstile cannot load (the server then decides). */
export async function getTurnstileToken(
  siteKey: string,
  container: HTMLElement,
): Promise<string | undefined> {
  let ts: TurnstileApi;
  try {
    ts = await loadScript();
  } catch {
    return undefined;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), 15_000);
    pending = (token) => {
      clearTimeout(timer);
      resolve(token);
    };
    if (widgetId === null) {
      widgetId = ts.render(container, {
        sitekey: siteKey,
        action: "relay",
        appearance: "interaction-only",
        execution: "execute",
        callback: (token: string) => pending?.(token),
        "error-callback": () => pending?.(undefined),
        "expired-callback": () => widgetId && ts.reset(widgetId),
      });
    } else {
      ts.reset(widgetId);
    }
    ts.execute(widgetId);
  });
}
