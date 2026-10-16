// Vitalos Super Admin client behaviour. Loaded as an external file so the CSP needs no inline script.
(function () {
  "use strict";

  function modal() {
    return document.getElementById("modal");
  }

  function closeModal() {
    var element = modal();
    if (element) element.innerHTML = "";
    document.body.classList.remove("overflow-hidden");
  }

  function showToast(message, tone) {
    var region = document.getElementById("toasts");
    if (!region || !message) return;
    var toast = document.createElement("div");
    toast.setAttribute("role", tone === "error" ? "alert" : "status");
    toast.className =
      tone === "error"
        ? "rounded-lg bg-rose-600 px-4 py-3 text-sm font-medium text-white shadow-lg"
        : "rounded-lg bg-midnight px-4 py-3 text-sm font-medium text-white shadow-lg dark:bg-slate-700";
    toast.textContent = message;
    region.appendChild(toast);
    window.setTimeout(function () {
      toast.remove();
    }, 5000);
  }

  function clearSearch() {
    var results = document.getElementById("search-results");
    if (results) results.innerHTML = "";
  }

  // ---------------------------------------------------------------------------------------------
  // Preferences live in first-party cookies so the server renders the right state (no flash).
  var root = document.documentElement;
  var isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  function setCookie(name, value) {
    var secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = name + "=" + value + "; Path=/; Max-Age=31536000; SameSite=Lax" + secure;
  }

  function isTyping(target) {
    return (
      target &&
      (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))
    );
  }

  // Sidebar: collapse to the icon rail on desktop (Ctrl/Cmd+B); off-canvas sheet below 768px.
  function sidebar() {
    return document.getElementById("sidebar");
  }

  function toggleCollapsed() {
    var collapsed = root.getAttribute("data-sidebar") !== "collapsed";
    root.setAttribute("data-sidebar", collapsed ? "collapsed" : "expanded");
    setCookie("sidebar_state", collapsed ? "collapsed" : "expanded");
    document.querySelectorAll("[data-sidebar-toggle]").forEach(function (button) {
      button.setAttribute("aria-expanded", collapsed ? "false" : "true");
      var label = button.querySelector(".nav-label");
      if (label) label.textContent = collapsed ? "Expand sidebar" : "Collapse sidebar";
    });
  }

  var sheetOpener = null;

  function openSheet(opener) {
    var element = sidebar();
    if (!element) return;
    sheetOpener = opener || document.activeElement;
    root.setAttribute("data-sidebar-open", "");
    var backdrop = document.querySelector("[data-sidebar-backdrop]");
    if (backdrop) backdrop.classList.remove("hidden");
    document.querySelectorAll("[data-sidebar-open]").forEach(function (button) {
      if (button !== root) button.setAttribute("aria-expanded", "true");
    });
    var first = element.querySelector("a, button");
    if (first) first.focus();
  }

  function closeSheet() {
    if (!root.hasAttribute("data-sidebar-open")) return;
    root.removeAttribute("data-sidebar-open");
    var backdrop = document.querySelector("[data-sidebar-backdrop]");
    if (backdrop) backdrop.classList.add("hidden");
    document.querySelectorAll("button[data-sidebar-open]").forEach(function (button) {
      button.setAttribute("aria-expanded", "false");
    });
    if (sheetOpener && sheetOpener.focus) sheetOpener.focus();
    sheetOpener = null;
  }

  function trapSheetFocus(event) {
    if (event.key !== "Tab" || !root.hasAttribute("data-sidebar-open")) return;
    var focusable = Array.prototype.filter.call(
      sidebar().querySelectorAll("a[href], button, summary, [tabindex]:not([tabindex='-1'])"),
      function (element) {
        return element.offsetParent !== null;
      },
    );
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  // Theme: system → light → dark → system.
  var THEMES = ["system", "light", "dark"];

  function cycleTheme() {
    var current = root.getAttribute("data-theme") || "system";
    var next = THEMES[(THEMES.indexOf(current) + 1) % THEMES.length];
    root.setAttribute("data-theme", next);
    setCookie("theme", next);
    document.querySelectorAll("[data-theme-label]").forEach(function (label) {
      label.textContent = next.charAt(0).toUpperCase() + next.slice(1);
    });
  }

  // Command palette (accessible combobox in a modal <dialog>).
  function palette() {
    return document.getElementById("palette");
  }

  function paletteOptions() {
    return Array.prototype.slice.call(document.querySelectorAll("#palette-list [data-palette-option]"));
  }

  function selectOption(index) {
    var options = paletteOptions();
    var input = document.querySelector("[data-palette-input]");
    if (!options.length || !input) {
      if (input) input.removeAttribute("aria-activedescendant");
      return;
    }
    var bounded = (index + options.length) % options.length;
    options.forEach(function (option, position) {
      option.setAttribute("aria-selected", position === bounded ? "true" : "false");
    });
    input.setAttribute("aria-activedescendant", options[bounded].id);
    options[bounded].scrollIntoView({ block: "nearest" });
  }

  function selectedIndex() {
    return paletteOptions().findIndex(function (option) {
      return option.getAttribute("aria-selected") === "true";
    });
  }

  function openPalette() {
    var dialog = palette();
    if (!dialog || dialog.open) return;
    closeSheet();
    dialog.showModal();
    var input = dialog.querySelector("[data-palette-input]");
    input.value = "";
    input.focus();
    if (window.htmx) window.htmx.trigger(input, "palette-open");
  }

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (target.closest("[data-sidebar-toggle]")) toggleCollapsed();
    if (target.closest("button[data-sidebar-open]")) openSheet(target.closest("button"));
    if (target.closest("[data-sidebar-close]") || target.matches("[data-sidebar-backdrop]")) closeSheet();
    if (target.closest("[data-theme-toggle]")) cycleTheme();
    if (target.closest("[data-palette-open]")) openPalette();
    // The top bar's Refresh link: reload the address bar's URL (HTMX may have moved it on).
    if (target.closest("a[data-refresh]") && !event.metaKey && !event.ctrlKey && !event.shiftKey) {
      event.preventDefault();
      window.location.reload();
    }
    var dialog = palette();
    if (dialog && target === dialog) dialog.close(); // Click on the backdrop.
  });

  document.addEventListener("keydown", function (event) {
    var mod = event.metaKey || event.ctrlKey;
    var key = event.key.toLowerCase();
    if (mod && key === "k") {
      event.preventDefault();
      openPalette();
      return;
    }
    if (mod && key === "b" && !isTyping(event.target) && sidebar()) {
      event.preventDefault();
      toggleCollapsed();
      return;
    }
    if (event.key === "Escape") closeSheet();
    trapSheetFocus(event);
    if (event.target.matches && event.target.matches("[data-palette-input]")) {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        selectOption(selectedIndex() + (event.key === "ArrowDown" ? 1 : -1));
      } else if (event.key === "Enter") {
        var options = paletteOptions();
        var chosen = options[selectedIndex()] || options[0];
        if (chosen) {
          event.preventDefault();
          window.location.assign(chosen.getAttribute("href"));
        }
      }
    }
  });

  document.addEventListener("htmx:afterSwap", function (event) {
    if (event.detail.target && event.detail.target.id === "palette-list") selectOption(0);
  });

  if (isMac) {
    document.querySelectorAll("[data-kbd-mod]").forEach(function (element) {
      element.textContent = "⌘K";
    });
  }


  // ---------------------------------------------------------------------------------------------
  // Enquiries inbox: keyboard shortcuts, composer tabs, canned responses, list/thread on mobile.
  function inboxRoot() {
    return document.querySelector("[data-enquiries]");
  }

  function enquiryRows() {
    return Array.prototype.slice.call(document.querySelectorAll("[data-enquiry-row]"));
  }

  function markSelectedRow() {
    enquiryRows().forEach(function (row) {
      var path = new URL(row.getAttribute("href"), window.location.href).pathname;
      if (path === window.location.pathname) row.setAttribute("aria-current", "page");
      else row.removeAttribute("aria-current");
    });
  }

  function moveSelection(step) {
    var rows = enquiryRows();
    if (!rows.length) return;
    var current = rows.indexOf(document.activeElement);
    if (current === -1) {
      current = rows.findIndex(function (row) {
        return row.getAttribute("aria-current") === "page";
      });
    }
    var next = rows[Math.min(Math.max(current + step, 0), rows.length - 1)] || rows[0];
    next.focus();
    next.scrollIntoView({ block: "nearest" });
  }

  function setComposerMode(mode, focus) {
    var composer = document.querySelector("[data-composer]");
    if (!composer) return;
    composer.setAttribute("data-mode", mode);
    composer.querySelectorAll("[data-composer-tab]").forEach(function (tab) {
      tab.setAttribute("aria-selected", tab.getAttribute("data-composer-tab") === mode ? "true" : "false");
    });
    var reply = document.getElementById("composer-reply");
    var note = document.getElementById("composer-note");
    if (reply) reply.hidden = mode !== "reply";
    if (note) note.hidden = mode !== "note";
    if (focus) {
      var panel = mode === "reply" ? reply : note;
      var field = panel && panel.querySelector("textarea");
      if (field) field.focus();
    }
  }

  // Details panel beside a thread: collapsible, remembered in a cookie the server reads (no flash).
  function toggleDetails() {
    var thread = document.querySelector("[data-thread]");
    if (!thread) return;
    var collapse = thread.getAttribute("data-details") !== "collapsed";
    thread.setAttribute("data-details", collapse ? "collapsed" : "expanded");
    setCookie("enquiry_details", collapse ? "collapsed" : "expanded");
    thread.querySelectorAll("[data-details-toggle]").forEach(function (button) {
      button.setAttribute("aria-expanded", collapse ? "false" : "true");
      var label = button.querySelector("[data-details-label]");
      if (label) label.textContent = collapse ? "Show details" : "Hide details";
    });
  }

  function clickAction(name) {
    var button = document.querySelector('[data-action="' + name + '"]');
    if (button) button.click();
  }

  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-details-toggle]")) toggleDetails();
    var tab = event.target.closest("[data-composer-tab]");
    if (tab) setComposerMode(tab.getAttribute("data-composer-tab"), true);
    var back = event.target.closest("[data-back-to-list]");
    if (back && inboxRoot()) {
      event.preventDefault();
      inboxRoot().setAttribute("data-open", "list");
      window.history.pushState({}, "", back.getAttribute("href"));
    }
  });

  document.addEventListener("change", function (event) {
    var select = event.target.closest("[data-canned-select]");
    if (!select || !select.value) return;
    var option = select.options[select.selectedIndex];
    var field = select.form && select.form.querySelector("[data-composer-body]");
    if (field) {
      field.value = (field.value ? field.value.replace(/\s*$/, "") + "\n\n" : "") + option.getAttribute("data-body");
      field.focus();
    }
    select.value = "";
  });

  document.addEventListener("keydown", function (event) {
    if (!inboxRoot() || event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return;
    if (document.querySelector("dialog[open]")) return;
    var handlers = {
      j: function () { moveSelection(1); },
      k: function () { moveSelection(-1); },
      r: function () { setComposerMode("reply", true); },
      n: function () { setComposerMode("note", true); },
      e: function () { clickAction("resolve"); },
      a: function () { clickAction("assign-me"); },
      s: function () { clickAction("spam"); },
      d: toggleDetails,
      "/": function () {
        var search = document.querySelector("[data-enquiry-search]");
        if (search) search.focus();
      },
      "?": function () {
        var help = document.getElementById("enquiry-shortcuts");
        if (help) help.showModal();
      },
    };
    var handler = handlers[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  });

  document.addEventListener("htmx:afterSwap", function (event) {
    var target = event.detail.target;
    if (!target) return;
    if (target.id === "enquiry-thread") {
      if (inboxRoot()) inboxRoot().setAttribute("data-open", "thread");
      markSelectedRow();
      var composer = target.querySelector("[data-composer]");
      if (composer) setComposerMode(composer.getAttribute("data-mode") || "reply", false);
    }
    if (target.id === "enquiry-list") markSelectedRow();
  });

  window.addEventListener("popstate", function () {
    if (inboxRoot() && !/\/enquiries\/VIT-\d+\/?$/.test(window.location.pathname)) {
      inboxRoot().setAttribute("data-open", "list");
    }
  });

  document.addEventListener("vsa-close-modal", closeModal);
  document.addEventListener("vsa-toast", function (event) {
    showToast(event.detail && event.detail.message);
  });

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      closeModal();
      clearSearch();
      document.querySelectorAll("details[open][data-menu]").forEach(function (menu) {
        menu.removeAttribute("open");
      });
    }
  });

  document.addEventListener("click", function (event) {
    var target = event.target;
    if (target.closest("[data-close-modal]") || target.matches("[data-modal-backdrop]")) {
      event.preventDefault();
      closeModal();
    }
    if (!target.closest("[data-search]")) clearSearch();
    document.querySelectorAll("details[open][data-menu]").forEach(function (menu) {
      if (!menu.contains(target)) menu.removeAttribute("open");
    });
    var copy = target.closest("[data-copy]");
    if (copy) {
      var source = document.getElementById(copy.getAttribute("data-copy"));
      if (source && navigator.clipboard) {
        navigator.clipboard.writeText(source.textContent.trim()).then(function () {
          copy.textContent = "Copied";
        });
      }
    }
  });

  document.addEventListener("htmx:afterSwap", function (event) {
    if (event.detail.target && event.detail.target.id === "modal") {
      document.body.classList.add("overflow-hidden");
      var first = event.detail.target.querySelector(
        "input:not([type=hidden]):not([type=checkbox]), select, textarea",
      );
      if (first) first.focus();
    }
  });

  document.addEventListener("htmx:responseError", function (event) {
    var status = event.detail.xhr ? event.detail.xhr.status : 0;
    var message =
      status === 403
        ? "You do not have permission to do that."
        : status === 429
          ? "Too many attempts. Please wait and try again."
          : "Something went wrong. Please try again.";
    showToast(message, "error");
  });

  document.addEventListener("htmx:sendError", function () {
    showToast("Network error. Check your connection and try again.", "error");
  });

  // Sidebar dropdowns (Mail): show or hide the child links.
  document.addEventListener("click", function (event) {
    var toggle = event.target.closest("[data-nav-toggle]");
    if (!toggle) return;
    var list = document.getElementById(toggle.getAttribute("aria-controls"));
    var open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    if (list) list.hidden = !open;
  });

  // Email template editor: insert a merge variable at the caret of the last focused text field.
  var lastTemplateField = null;
  document.addEventListener("focusin", function (event) {
    var field = event.target;
    if (field.closest && field.closest("[data-template-form]") && field.matches("input[type=text], textarea")) {
      lastTemplateField = field;
    }
  });
  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-insert-variable]");
    if (!button) return;
    event.preventDefault();
    var token = button.getAttribute("data-insert-variable");
    var field = lastTemplateField && document.body.contains(lastTemplateField) ? lastTemplateField : null;
    if (!field) {
      if (navigator.clipboard) navigator.clipboard.writeText(token);
      showToast("Copied " + token + ". Click into a field to insert variables.", "info");
      return;
    }
    var start = field.selectionStart == null ? field.value.length : field.selectionStart;
    var end = field.selectionEnd == null ? start : field.selectionEnd;
    field.setRangeText(token, start, end, "end");
    field.focus();
    field.dispatchEvent(new Event("input", { bubbles: true }));
  });

  // Use template: highlight a detail as soon as it is emptied (the server re-checks on every preview).
  document.addEventListener("input", function (event) {
    var field = event.target;
    if (!field.matches || !field.matches("[data-use-field]")) return;
    var empty = field.value.trim() === "";
    field.setAttribute("data-empty", empty ? "true" : "false");
    var hint = document.getElementById(field.getAttribute("aria-describedby"));
    if (hint && hint.hasAttribute("data-use-hint")) hint.hidden = !empty;
  });

  // Use template: copy buttons. The server renders the email for this recipient (and audits it);
  // the clipboard write starts inside the click so Safari and Chrome accept it, with the payload as a promise.
  function useStatus(message, failed) {
    var region = document.getElementById("use-status");
    if (!region) return;
    region.setAttribute("data-state", failed ? "error" : "ok");
    region.textContent = "";
    window.setTimeout(function () {
      region.textContent = message;
    }, 50);
  }

  function usePayload(button) {
    var form = document.getElementById("use-form");
    var data = new FormData(form);
    data.append("action", button.getAttribute("data-use-copy"));
    return fetch(button.getAttribute("data-use-url"), {
      method: "POST",
      body: data,
      credentials: "same-origin",
      headers: { "X-Requested-With": "XMLHttpRequest" },
    }).then(function (response) {
      return response.json().then(
        function (body) {
          if (!response.ok) throw new Error(body.error || "Could not prepare the email.");
          return body;
        },
        function () {
          throw new Error("Could not prepare the email.");
        },
      );
    });
  }

  function textBlob(value) {
    return new Blob([value], { type: "text/plain" });
  }

  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-use-copy]");
    if (!button || button.disabled) return;
    event.preventDefault();
    var action = button.getAttribute("data-use-copy");
    var labels = { copy_subject: "subject", copy_email: "email", copy_text: "plain text" };
    var payload = usePayload(button);
    var rich = action === "copy_email" && window.ClipboardItem && navigator.clipboard && navigator.clipboard.write;
    var done;
    if (!navigator.clipboard) {
      payload.catch(function () {});
      useStatus("This browser cannot copy to the clipboard here. Use Download .eml instead.", true);
      return;
    }
    if (window.ClipboardItem && navigator.clipboard.write) {
      var item = {
        "text/plain": payload.then(function (body) {
          return textBlob(action === "copy_subject" ? body.subject : body.text);
        }),
      };
      if (rich) {
        item["text/html"] = payload.then(function (body) {
          return new Blob([body.html], { type: "text/html" });
        });
      }
      done = navigator.clipboard.write([new window.ClipboardItem(item)]);
    } else {
      // No ClipboardItem: plain text only.
      done = payload.then(function (body) {
        return navigator.clipboard.writeText(action === "copy_subject" ? body.subject : body.text);
      });
    }
    done.then(
      function () {
        var plainOnly = action === "copy_email" && !rich;
        useStatus(
          "Copied " + labels[action] + (plainOnly ? " as plain text (this browser cannot copy the layout)." : "."),
          false,
        );
      },
      function (error) {
        payload.catch(function () {});
        useStatus(
          error && error.message && error.name !== "NotAllowedError" ? error.message : "Could not copy. Try again.",
          true,
        );
      },
    );
  });

  // Auto-dismiss server-rendered flash messages.
  window.setTimeout(function () {
    document.querySelectorAll("[data-autodismiss]").forEach(function (element) {
      element.remove();
    });
  }, 6000);
})();
