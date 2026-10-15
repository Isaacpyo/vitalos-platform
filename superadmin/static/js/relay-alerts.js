// Relay alerts on every admin page (loaded only for people who can use Relay, when Relay is configured).
// Polls /relay/pulse/ every 20 seconds (local rows only), shows a toast at the top right for each new
// alert, plays an optional short beep and raises a browser notification when the tab is in the
// background and the person allowed it. Relay pages also ask for an immediate poll on realtime pings.
// External file, no inline script: the strict CSP stays as it is.
(function () {
  "use strict";

  var root = document.getElementById("relay-toasts");
  if (!root || !window.fetch) return;

  var PULSE_URL = root.getAttribute("data-pulse-url");
  var STORAGE_KEY = "vsa.relay.cursor";
  var POLL_MS = 20000;
  var SHOW_MS = 12000;
  var MAX_TOASTS = 3;
  var prefs = { sound: false, browser: false };
  var busy = false;
  var cursor = initialCursor();

  function initialCursor() {
    var server = parseInt(root.getAttribute("data-cursor") || "0", 10) || 0;
    var stored = 0;
    try {
      stored = parseInt(window.localStorage.getItem(STORAGE_KEY) || "0", 10) || 0;
    } catch (error) {
      stored = 0;
    }
    // A stored cursor behind the page's lets alerts that arrived while navigating still show.
    return stored > 0 && stored <= server ? stored : server;
  }

  function saveCursor(value) {
    cursor = value;
    try {
      window.localStorage.setItem(STORAGE_KEY, String(value));
    } catch (error) {
      // Private mode: the cursor lives for this page only.
    }
  }

  function refreshBadges() {
    if (window.htmx) window.htmx.trigger(document.body, "relay-badge-refresh");
  }

  function beep() {
    try {
      var Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      var context = beep.context || (beep.context = new Context());
      var oscillator = context.createOscillator();
      var gain = context.createGain();
      var now = context.currentTime;
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.22);
    } catch (error) {
      // Sound is optional; browsers may block it until the page has been used.
    }
  }

  function browserNotification(item) {
    if (!prefs.browser || !document.hidden || !("Notification" in window)) return;
    if (window.Notification.permission !== "granted") return;
    try {
      var notification = new window.Notification(item.title, {
        body: item.quote ? "“" + item.quote + "”" : item.body || "",
        tag: "relay-" + item.id,
      });
      notification.onclick = function () {
        window.focus();
        window.location.assign(item.url);
        notification.close();
      };
    } catch (error) {
      // Some browsers only allow notifications from a service worker; the toast still shows.
    }
  }

  function element(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function showToast(item) {
    var toast = element("div", "relay-toast");
    toast.setAttribute("role", "status");
    toast.setAttribute("data-relay-toast", String(item.id));
    var ring = element("span", "mt-[5px] block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-mineral-300");
    ring.setAttribute("aria-hidden", "true");
    var body = element("div", "flex min-w-0 flex-1 flex-col gap-1.5");
    body.appendChild(element("p", "text-[15px] font-semibold", item.title));
    if (item.quote) {
      body.appendChild(element("p", "text-sm leading-5 break-words text-slate-300", "“" + item.quote + "”"));
    }
    if (item.meta) body.appendChild(element("p", "relay-mono text-slate-300", item.meta));
    var actions = element("div", "mt-1.5 flex flex-wrap gap-2");
    var open = element("a", "relay-toast-open", "Open conversation");
    open.href = item.url;
    var dismiss = element("button", "relay-toast-dismiss", "Dismiss");
    dismiss.type = "button";
    actions.appendChild(open);
    actions.appendChild(dismiss);
    body.appendChild(actions);
    toast.appendChild(ring);
    toast.appendChild(body);

    var timer = null;
    function remove() {
      window.clearTimeout(timer);
      toast.remove();
    }
    function schedule() {
      window.clearTimeout(timer);
      timer = window.setTimeout(remove, SHOW_MS);
    }
    // Stays while hovered or focused (WCAG 2.2.1), then leaves 12 seconds after the last interaction.
    toast.addEventListener("mouseenter", function () {
      window.clearTimeout(timer);
    });
    toast.addEventListener("focusin", function () {
      window.clearTimeout(timer);
    });
    toast.addEventListener("mouseleave", function () {
      if (!toast.contains(document.activeElement)) schedule();
    });
    toast.addEventListener("focusout", function (event) {
      if (!toast.contains(event.relatedTarget)) schedule();
    });
    dismiss.addEventListener("click", remove);

    while (root.children.length >= MAX_TOASTS) root.firstElementChild.remove();
    root.appendChild(toast);
    schedule();
  }

  function poll() {
    if (busy || !PULSE_URL) return;
    busy = true;
    window
      .fetch(PULSE_URL + "?since=" + encodeURIComponent(cursor), {
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      })
      .then(function (response) {
        return response.ok ? response.json() : null;
      })
      .then(function (data) {
        busy = false;
        if (!data || !data.enabled) return;
        prefs.sound = !!data.sound;
        prefs.browser = !!data.browser;
        if (typeof data.cursor === "number" && data.cursor > cursor) saveCursor(data.cursor);
        var items = data.items || [];
        items.forEach(function (item) {
          showToast(item);
          browserNotification(item);
        });
        if (items.length) {
          if (prefs.sound) beep();
          refreshBadges();
        }
      })
      .catch(function () {
        busy = false;
      });
  }

  document.addEventListener("relay-pulse-now", poll);
  window.setInterval(poll, POLL_MS);
  window.setTimeout(poll, 1500);
})();
