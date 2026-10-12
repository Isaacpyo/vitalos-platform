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

  // Auto-dismiss server-rendered flash messages.
  window.setTimeout(function () {
    document.querySelectorAll("[data-autodismiss]").forEach(function (element) {
      element.remove();
    });
  }, 6000);
})();
