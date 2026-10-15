// Relay pages: realtime pings, polling fallback, new messages, typing, availability heartbeat and the
// small interactions of the inbox (copy transcript, inline delete confirmation, mobile list/thread).
//
// Realtime is "ping, then fetch": a minimal Phoenix v1 JSON client joins the Supabase Realtime channel
// (Broadcast) and each ping only asks the server for fresh HTML. Pings carry no content. When the
// socket is down, the page polls every 10 seconds instead. No dependencies; loaded with the page's
// CSP nonce, and the page's CSP allows the socket's origin on Relay pages only.
(function () {
  "use strict";

  var configElement = document.getElementById("relay-config");
  if (!configElement) return;
  var config = {};
  try {
    config = JSON.parse(configElement.textContent || "{}") || {};
  } catch (error) {
    config = {};
  }

  var POLL_MS = (config.pollSeconds || 10) * 1000;
  var HEARTBEAT_MS = (config.heartbeatSeconds || 60) * 1000;
  var TYPING_THROTTLE_MS = 3000;
  var TYPING_SHOW_MS = 6000;
  var PHOENIX_HEARTBEAT_MS = 25000;
  var BACKOFF_MS = [1000, 2000, 5000, 10000, 30000];

  // --- Helpers -----------------------------------------------------------------------------------
  function csrfToken() {
    try {
      return JSON.parse(document.body.getAttribute("hx-headers") || "{}")["X-CSRFToken"] || "";
    } catch (error) {
      return "";
    }
  }

  function post(url, data) {
    return window.fetch(url, {
      method: "POST",
      credentials: "same-origin",
      headers: { "X-CSRFToken": csrfToken(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(data || {}).toString(),
    });
  }

  function trigger(name) {
    if (window.htmx) window.htmx.trigger(document.body, name);
  }

  function toast(message) {
    document.dispatchEvent(new CustomEvent("vsa-toast", { detail: { message: message } }));
  }

  function thread() {
    return document.querySelector("[data-relay-thread]");
  }

  function messagesLog() {
    return document.getElementById("relay-messages");
  }

  function inboxRoot() {
    return document.querySelector("[data-relay-inbox]");
  }

  function nearBottom(element) {
    return element.scrollHeight - element.scrollTop - element.clientHeight < 120;
  }

  function scrollToEnd() {
    var log = messagesLog();
    if (log) log.scrollTop = log.scrollHeight;
  }

  function lastCreated() {
    var items = document.querySelectorAll("#relay-messages [data-created]");
    return items.length ? items[items.length - 1].getAttribute("data-created") : "";
  }

  function markSelectedRow() {
    var current = thread();
    var id = current ? current.getAttribute("data-relay-thread") : "";
    document.querySelectorAll("[data-relay-row]").forEach(function (row) {
      if (row.getAttribute("data-relay-row") === id) row.setAttribute("aria-current", "page");
      else row.removeAttribute("aria-current");
    });
  }

  // --- Thread: new messages, status changes, visitor typing ----------------------------------------
  var fetchingMessages = false;

  function fetchMessages() {
    var current = thread();
    if (!current || fetchingMessages || !window.htmx) return;
    fetchingMessages = true;
    var url = current.getAttribute("data-messages-url") + "?after=" + encodeURIComponent(lastCreated());
    window.htmx.ajax("GET", url, { target: "#relay-messages", swap: "beforeend" }).then(
      function () {
        fetchingMessages = false;
      },
      function () {
        fetchingMessages = false;
      },
    );
  }

  function refreshThread() {
    var current = thread();
    if (!current || !window.htmx) return;
    // Keep what the admin is typing across the refresh.
    var reply = document.getElementById("relay-reply");
    var note = document.getElementById("relay-note");
    var drafts = { reply: reply ? reply.value : "", note: note ? note.value : "" };
    window.htmx
      .ajax("GET", current.getAttribute("data-thread-url"), { target: "#relay-thread", swap: "innerHTML" })
      .then(function () {
        var newReply = document.getElementById("relay-reply");
        var newNote = document.getElementById("relay-note");
        if (newReply && drafts.reply) newReply.value = drafts.reply;
        if (newNote && drafts.note) newNote.value = drafts.note;
      });
  }

  var typingTimer = null;

  function showTyping() {
    var indicator = document.getElementById("relay-typing");
    if (!indicator) return;
    indicator.hidden = false;
    window.clearTimeout(typingTimer);
    typingTimer = window.setTimeout(function () {
      indicator.hidden = true;
    }, TYPING_SHOW_MS);
  }

  document.addEventListener("htmx:beforeSwap", function (event) {
    var target = event.detail.target;
    if (target && target.id === "relay-messages") target.setAttribute("data-stick", nearBottom(target) ? "1" : "0");
  });

  document.addEventListener("htmx:afterSwap", function (event) {
    var target = event.detail.target;
    if (!target) return;
    if (target.id === "relay-messages") {
      var state = target.querySelector("template[data-relay-state]");
      var seen = {};
      target.querySelectorAll("[data-message]").forEach(function (item) {
        var id = item.getAttribute("data-message");
        if (seen[id]) item.remove();
        seen[id] = true;
      });
      if (target.getAttribute("data-stick") === "1") scrollToEnd();
      if (state) {
        var current = thread();
        if (state.getAttribute("data-typing") === "1") showTyping();
        if (
          current &&
          (state.getAttribute("data-status") !== current.getAttribute("data-status") ||
            state.getAttribute("data-assigned") !== current.getAttribute("data-assigned"))
        ) {
          refreshThread();
        }
        state.remove();
      }
    }
    if (target.id === "relay-thread") {
      var root = inboxRoot();
      if (root) root.setAttribute("data-open", "thread");
      markSelectedRow();
      scrollToEnd();
    }
    if (target.id === "relay-list") markSelectedRow();
  });

  // --- Realtime (Phoenix v1 JSON over Supabase Realtime) -------------------------------------------
  var socket = null;
  var socketUp = false;
  var ref = 0;
  var heartbeatTimer = null;
  var attempts = 0;

  function nextRef() {
    ref += 1;
    return String(ref);
  }

  function send(message) {
    if (socket && socket.readyState === 1) socket.send(JSON.stringify(message));
  }

  function onPing(name, payload) {
    var current = thread();
    var currentId = current ? current.getAttribute("data-relay-thread") : "";
    if (name === "inbox_changed") {
      if (!document.activeElement || !document.activeElement.closest("#relay-list")) trigger("relay-inbox-changed");
      trigger("relay-badge-refresh");
      if (current && (!payload.conversationId || payload.conversationId === currentId)) fetchMessages();
    } else if (name === "typing") {
      if (payload.by === "visitor" && payload.conversationId && payload.conversationId === currentId) showTyping();
    } else if (name === "notification") {
      document.dispatchEvent(new CustomEvent("relay-pulse-now"));
      trigger("relay-badge-refresh");
    }
  }

  function reconnectLater() {
    var delay = BACKOFF_MS[Math.min(attempts, BACKOFF_MS.length - 1)];
    attempts += 1;
    window.setTimeout(connect, delay);
  }

  function connect() {
    var realtime = config.realtime;
    if (!realtime || !realtime.socket || !window.WebSocket) return;
    try {
      socket = new window.WebSocket(realtime.socket);
    } catch (error) {
      reconnectLater();
      return;
    }
    socket.onopen = function () {
      send({
        topic: realtime.topic,
        event: "phx_join",
        payload: { config: { broadcast: { self: false } } },
        ref: nextRef(),
      });
      window.clearInterval(heartbeatTimer);
      heartbeatTimer = window.setInterval(function () {
        send({ topic: "phoenix", event: "heartbeat", payload: {}, ref: nextRef() });
      }, PHOENIX_HEARTBEAT_MS);
    };
    socket.onmessage = function (event) {
      var message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if (message.event === "phx_reply" && message.topic === realtime.topic) {
        socketUp = !!(message.payload && message.payload.status === "ok");
        if (socketUp) attempts = 0;
      } else if (message.event === "broadcast" && message.payload) {
        onPing(message.payload.event, message.payload.payload || {});
      } else if (message.event === "phx_error" || message.event === "phx_close") {
        socketUp = false;
      }
    };
    socket.onclose = function () {
      socketUp = false;
      window.clearInterval(heartbeatTimer);
      reconnectLater();
    };
    socket.onerror = function () {
      try {
        socket.close();
      } catch (error) {
        // Already closed.
      }
    };
  }

  // Fallback: while the socket is down, poll every 10 seconds (only while the tab is visible).
  window.setInterval(function () {
    if (socketUp || document.hidden) return;
    if (!document.activeElement || !document.activeElement.closest("#relay-list")) trigger("relay-inbox-changed");
    fetchMessages();
  }, POLL_MS);

  // --- Availability heartbeat (keeps the admin's last seen time while a Relay page is open) ---------
  if (config.availabilityUrl) {
    window.setInterval(function () {
      post(config.availabilityUrl, { heartbeat: "1" }).catch(function () {});
    }, HEARTBEAT_MS);
  }

  // --- Admin typing pings (throttled to one every 3 seconds) ---------------------------------------
  var lastTypingPing = 0;
  document.addEventListener("input", function (event) {
    if (!event.target.matches || !event.target.matches("[data-relay-typing]")) return;
    var current = thread();
    var now = Date.now();
    if (!current || now - lastTypingPing < TYPING_THROTTLE_MS) return;
    lastTypingPing = now;
    post(current.getAttribute("data-typing-url")).catch(function () {});
  });

  // Ctrl/Cmd+Enter sends the reply or note.
  document.addEventListener("keydown", function (event) {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    var field = event.target;
    if (field && field.closest && field.closest("[data-composer]") && field.form) {
      event.preventDefault();
      field.form.requestSubmit();
    }
  });

  // --- Clicks: transcript, inline confirmation, back to the list -----------------------------------
  function copyTranscript(url) {
    var text = window
      .fetch(url, { credentials: "same-origin", headers: { Accept: "application/json" } })
      .then(function (response) {
        return response.json().then(function (body) {
          if (!response.ok) throw new Error(body.error || "The transcript could not be copied.");
          return body.text || "";
        });
      });
    if (!navigator.clipboard) {
      text.catch(function () {});
      toast("This browser cannot copy to the clipboard here.");
      return;
    }
    var done;
    if (window.ClipboardItem && navigator.clipboard.write) {
      // Start the clipboard write inside the click so Safari keeps the permission.
      done = navigator.clipboard.write([
        new window.ClipboardItem({
          "text/plain": text.then(function (value) {
            return new Blob([value], { type: "text/plain" });
          }),
        }),
      ]);
    } else {
      done = text.then(function (value) {
        return navigator.clipboard.writeText(value);
      });
    }
    done.then(
      function () {
        toast("Transcript copied.");
      },
      function (error) {
        text.catch(function () {});
        toast(error && error.message && error.name !== "NotAllowedError" ? error.message : "Could not copy. Try again.");
      },
    );
  }

  document.addEventListener("click", function (event) {
    var copy = event.target.closest("[data-relay-transcript]");
    if (copy) {
      event.preventDefault();
      copyTranscript(copy.getAttribute("data-relay-transcript"));
      return;
    }
    var confirm = event.target.closest("[data-relay-confirm]");
    if (confirm) {
      var panel = document.getElementById(confirm.getAttribute("data-relay-confirm"));
      if (panel) {
        panel.hidden = !panel.hidden;
        document.querySelectorAll('[aria-controls="' + panel.id + '"]').forEach(function (button) {
          button.setAttribute("aria-expanded", panel.hidden ? "false" : "true");
        });
        if (!panel.hidden) {
          var first = panel.querySelector("button");
          if (first) first.focus();
        }
      }
      return;
    }
    var back = event.target.closest("[data-relay-back]");
    if (back && inboxRoot()) {
      event.preventDefault();
      inboxRoot().setAttribute("data-open", "list");
      window.history.pushState({}, "", back.getAttribute("href"));
    }
  });

  window.addEventListener("popstate", function () {
    var root = inboxRoot();
    if (root && !/\/relay\/inbox\/[0-9a-fA-F-]{36}\/?$/.test(window.location.pathname)) {
      root.setAttribute("data-open", "list");
    }
  });

  // --- My notifications: ask the browser before turning browser notifications on -------------------
  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form.matches || !form.matches("[data-relay-browser-form]")) return;
    var button = form.querySelector("[data-relay-browser-permission]");
    if (!button || button.getAttribute("data-relay-browser-permission") !== "on") return;
    var status = document.getElementById("relay-browser-status");
    if (!("Notification" in window)) {
      event.preventDefault();
      if (status) status.textContent = "This browser does not support notifications.";
      return;
    }
    if (window.Notification.permission === "granted") return;
    event.preventDefault();
    window.Notification.requestPermission().then(function (permission) {
      if (permission === "granted") {
        form.submit();
      } else if (status) {
        status.textContent = "The browser blocked notifications. Allow them for this site, then try again.";
      }
    });
  });

  markSelectedRow();
  scrollToEnd();
  connect();
})();
