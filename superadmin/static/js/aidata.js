// AI & Data workspace behaviour (ADR-055). External file so the CSP needs no inline script.
// Everything here is an enhancement: every page works with forms and links alone.
(function () {
  "use strict";

  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function toast(message, tone) {
    document.dispatchEvent(new CustomEvent("vsa-toast", { detail: { message: message, tone: tone } }));
  }

  // --- Toasts: completed actions arrive as Django messages; show them in the polite live region. ----------
  function messagesToToasts() {
    if (!document.querySelector("[data-aid-admin]")) return;
    document.querySelectorAll("main [data-autodismiss]").forEach(function (box) {
      box.querySelectorAll("[role=status]").forEach(function (item) {
        toast(item.textContent.trim(), /rose/.test(item.className) ? "error" : "ok");
      });
      box.hidden = true;
    });
  }

  // A request that cannot complete is recoverable: say so, and nothing was lost.
  document.addEventListener("htmx:sendError", function () {
    toast("Could not reach the server. Nothing was changed. Try again.", "error");
  });
  document.addEventListener("htmx:responseError", function (event) {
    var xhr = event.detail && event.detail.xhr;
    if (xhr && xhr.status === 403) toast("You do not have permission to do that.", "error");
    else toast("That did not save (error " + (xhr ? xhr.status : "?") + "). Try again.", "error");
  });

  // --- Dialogs and drawers (native <dialog>) -----------------------------------------------------------
  document.addEventListener("click", function (event) {
    var opener = event.target.closest("[data-dialog-open]");
    if (opener) {
      var dialog = document.getElementById(opener.getAttribute("data-dialog-open"));
      if (dialog && typeof dialog.showModal === "function") {
        event.preventDefault();
        dialog.showModal();
        var first = dialog.querySelector("[autofocus], textarea, input:not([type=hidden]), select, button");
        if (first) first.focus();
      }
      return;
    }
    if (event.target.closest("[data-dialog-close]")) {
      var host = event.target.closest("dialog");
      if (host) host.close();
      return;
    }
    if (event.target.tagName === "DIALOG" && event.target.classList.contains("aid-dialog")) {
      event.target.close(); // Click on the backdrop.
    }
  });

  // --- Resizable split panels: pointer drag and arrow keys on the separator ------------------------------
  function initSplit(container) {
    var handle = container.querySelector(".aid-split-handle");
    if (!handle) return;
    var value = 46;
    function set(next) {
      value = Math.max(25, Math.min(75, next));
      container.style.setProperty("--split", value + "%");
      handle.setAttribute("aria-valuenow", String(Math.round(value)));
    }
    set(value);
    handle.addEventListener("keydown", function (event) {
      var step = event.shiftKey ? 10 : 4;
      if (event.key === "ArrowLeft") set(value - step);
      else if (event.key === "ArrowRight") set(value + step);
      else if (event.key === "Home") set(25);
      else if (event.key === "End") set(75);
      else return;
      event.preventDefault();
    });
    handle.addEventListener("pointerdown", function (event) {
      event.preventDefault();
      handle.setPointerCapture(event.pointerId);
      var box = container.getBoundingClientRect();
      function move(ev) {
        set(((ev.clientX - box.left) / box.width) * 100);
      }
      function stop() {
        handle.removeEventListener("pointermove", move);
        handle.removeEventListener("pointerup", stop);
        handle.removeEventListener("pointercancel", stop);
      }
      handle.addEventListener("pointermove", move);
      handle.addEventListener("pointerup", stop);
      handle.addEventListener("pointercancel", stop);
    });
  }

  // --- Composer attachments: plain-text files only, size-limited, read in the browser ----------------------
  var MAX_ATTACH = 100 * 1024;
  var TEXT_EXT = /\.(txt|md|csv|eml|log|json)$/i;
  function initAttach(input) {
    input.addEventListener("change", function () {
      var target = document.getElementById(input.getAttribute("data-attach-target"));
      var status = document.getElementById(input.getAttribute("data-attach-status"));
      var file = input.files && input.files[0];
      if (!file || !target) return;
      function say(text, bad) {
        if (status) {
          status.textContent = text;
          status.className = bad ? "aid-error" : "aid-help";
        }
      }
      if (!(file.type.indexOf("text/") === 0 || TEXT_EXT.test(file.name))) {
        say("Only plain-text files can be attached (.txt, .md, .csv, .eml). Paste the text instead.", true);
        input.value = "";
        return;
      }
      if (file.size > MAX_ATTACH) {
        say("That file is over 100 KB. Paste the relevant part instead.", true);
        input.value = "";
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        var text = String(reader.result || "").replace(/\u0000/g, "");
        target.value = (target.value ? target.value.replace(/\s+$/, "") + "\n\n" : "") + text;
        target.dispatchEvent(new Event("input", { bubbles: true }));
        say("Added the text of " + file.name + ". It is treated as untrusted text, never as instructions.", false);
        input.value = "";
      };
      reader.onerror = function () {
        say("That file could not be read. Paste the text instead.", true);
      };
      reader.readAsText(file);
    });
  }

  // --- Character counters ---------------------------------------------------------------------------------
  function initCounter(area) {
    var out = document.getElementById(area.getAttribute("data-count-for"));
    if (!out) return;
    var limit = parseInt(area.getAttribute("maxlength") || "0", 10);
    function update() {
      out.textContent = area.value.length + (limit ? " / " + limit : "") + " characters";
    }
    area.addEventListener("input", update);
    update();
  }

  // --- Evidence: a suggestion's "Show source" marks and scrolls to the quoted span ---------------------------
  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-show-evidence]");
    if (!button) return;
    var field = button.getAttribute("data-show-evidence");
    var scope = document.querySelector(button.getAttribute("data-evidence-scope") || "[data-source]") || document;
    var marks = scope.querySelectorAll(".aid-mark");
    var first = null;
    marks.forEach(function (mark) {
      var on = mark.getAttribute("data-field") === field;
      mark.setAttribute("data-active", on ? "true" : "false");
      if (on && !first) first = mark;
    });
    if (first) {
      first.setAttribute("tabindex", "-1");
      first.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
      first.focus({ preventScroll: true });
    } else {
      toast("This value has no quoted source span.", "ok");
    }
  });

  // --- Repeating rows (workflow steps, lists): add, remove, move ------------------------------------------------
  document.addEventListener("click", function (event) {
    var add = event.target.closest("[data-add-row]");
    if (add) {
      var list = document.getElementById(add.getAttribute("data-add-row"));
      var rows = list && list.querySelectorAll("[data-row]");
      if (!rows || !rows.length) return;
      var copy = rows[rows.length - 1].cloneNode(true);
      copy.hidden = false;
      copy.querySelectorAll("input, textarea").forEach(function (field) {
        field.value = "";
      });
      list.appendChild(copy);
      var field = copy.querySelector("input, textarea");
      if (field) field.focus();
      return;
    }
    var row = event.target.closest("[data-row]");
    if (!row) return;
    if (event.target.closest("[data-row-remove]")) {
      row.querySelectorAll("input, textarea").forEach(function (field) {
        field.value = "";
      });
      row.hidden = true;
    } else if (event.target.closest("[data-row-up]") && row.previousElementSibling && row.previousElementSibling.hasAttribute("data-row")) {
      row.parentNode.insertBefore(row, row.previousElementSibling);
    } else if (event.target.closest("[data-row-down]") && row.nextElementSibling && row.nextElementSibling.hasAttribute("data-row")) {
      row.parentNode.insertBefore(row.nextElementSibling, row);
    }
  });

  // --- Inline save feedback for HTMX forms --------------------------------------------------------------------
  document.addEventListener("htmx:beforeRequest", function (event) {
    var form = event.target.closest && event.target.closest("[data-inline-save]");
    var status = form && form.querySelector("[data-save-status]");
    if (status) status.textContent = "Saving…";
  });
  document.addEventListener("htmx:afterRequest", function (event) {
    var form = event.target.closest && event.target.closest("[data-inline-save]");
    var status = form && form.querySelector("[data-save-status]");
    if (!status) return;
    var ok = event.detail && event.detail.successful;
    status.textContent = ok ? "Saved just now" : "Not saved. Try again.";
    status.className = ok ? "aid-help" : "aid-error";
  });

  // --- Stop a double submit on the client (the server is idempotent anyway) ----------------------------------------
  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!form.hasAttribute || !form.hasAttribute("data-once")) return;
    if (form.getAttribute("data-submitted") === "true") {
      event.preventDefault();
      return;
    }
    form.setAttribute("data-submitted", "true");
    form.querySelectorAll("button[type=submit]").forEach(function (button) {
      button.setAttribute("aria-busy", "true");
    });
  });

  // --- Suggested starting points fill the composer (the person still edits and submits) ---------------------
  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-fill-text]");
    if (!button) return;
    var target = document.getElementById(button.getAttribute("data-fill-target"));
    if (!target) return;
    target.value = button.getAttribute("data-fill-text");
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.focus();
  });

  // --- Print button ---------------------------------------------------------------------------------------------
  document.addEventListener("click", function (event) {
    if (event.target.closest("[data-print]")) {
      event.preventDefault();
      window.print();
    }
  });

  function init() {
    messagesToToasts();
    document.querySelectorAll("[data-split]").forEach(initSplit);
    document.querySelectorAll("input[data-attach-target]").forEach(initAttach);
    document.querySelectorAll("textarea[data-count-for]").forEach(initCounter);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
  document.addEventListener("htmx:afterSwap", function (event) {
    var root = event.target;
    if (root.querySelectorAll) {
      root.querySelectorAll("[data-split]").forEach(initSplit);
      root.querySelectorAll("textarea[data-count-for]").forEach(initCounter);
    }
  });
})();
