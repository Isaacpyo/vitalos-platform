/* Vitalos client portal: small progressive enhancements. No framework, no timers that pretend work is happening. */
(function () {
  "use strict";

  // Native <dialog>: open buttons, close buttons, close on backdrop click, return focus to the opener.
  document.addEventListener("click", function (event) {
    var opener = event.target.closest("[data-dialog-open]");
    if (opener) {
      var dialog = document.getElementById(opener.getAttribute("data-dialog-open"));
      if (dialog && typeof dialog.showModal === "function") {
        dialog._opener = opener;
        dialog.showModal();
        var focus = dialog.querySelector("[data-autofocus]") || dialog.querySelector("textarea, input, button");
        if (focus) focus.focus();
      }
      return;
    }
    var closer = event.target.closest("[data-dialog-close]");
    if (closer) {
      var parent = closer.closest("dialog");
      if (parent) parent.close();
      return;
    }
    if (event.target.tagName === "DIALOG" && event.target.open) {
      var rect = event.target.getBoundingClientRect();
      var inside =
        event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) event.target.close();
    }
  });
  document.addEventListener(
    "close",
    function (event) {
      if (event.target.tagName === "DIALOG" && event.target._opener) event.target._opener.focus();
    },
    true
  );

  // Toasts: server messages are rendered inside the aria-live region; allow dismissal, auto-hide the calm ones.
  function wireToast(toast) {
    var close = toast.querySelector("[data-toast-close]");
    if (close) close.addEventListener("click", function () { toast.remove(); });
    if (!toast.classList.contains("toast--error") && !toast.classList.contains("toast--warning")) {
      window.setTimeout(function () { toast.remove(); }, 9000);
    }
  }
  document.querySelectorAll(".toast").forEach(wireToast);

  // Busy state: stop double submissions and show that the request was sent.
  document.addEventListener("submit", function (event) {
    var form = event.target;
    if (!(form instanceof HTMLFormElement) || form.hasAttribute("hx-post")) return;
    var button = event.submitter || form.querySelector("button[type=submit]");
    if (button && !button.hasAttribute("data-no-busy")) {
      window.setTimeout(function () {
        button.classList.add("is-busy");
        button.setAttribute("aria-busy", "true");
      }, 0);
    }
  });
  // Back/forward cache: clear any busy state.
  window.addEventListener("pageshow", function () {
    document.querySelectorAll(".is-busy").forEach(function (el) {
      el.classList.remove("is-busy");
      el.removeAttribute("aria-busy");
    });
  });

  // "Use this draft": copy an assistant draft into a composer. The customer edits and sends it themselves.
  document.addEventListener("click", function (event) {
    var button = event.target.closest("[data-fill]");
    if (!button) return;
    var target = document.querySelector(button.getAttribute("data-fill"));
    var source = document.getElementById(button.getAttribute("data-from"));
    if (target && source) {
      target.value = source.textContent.trim();
      target.focus();
      target.scrollIntoView({ block: "center" });
    }
  });

  // HTMX: mark the answer region busy while loading; announce errors in plain words.
  document.body.addEventListener("htmx:beforeRequest", function (event) {
    var target = event.detail.target;
    if (target) target.setAttribute("aria-busy", "true");
  });
  document.body.addEventListener("htmx:afterRequest", function (event) {
    var target = event.detail.target;
    if (target) target.removeAttribute("aria-busy");
  });
  document.body.addEventListener("htmx:responseError", function (event) {
    var target = event.detail.target;
    if (target) {
      target.innerHTML =
        '<p class="notice notice--warn" role="alert">That did not work. Nothing was changed. Please try again, or ask in the discussion.</p>';
    }
  });
  document.body.addEventListener("htmx:sendError", function (event) {
    var target = event.detail.target;
    if (target) {
      target.innerHTML =
        '<p class="notice notice--warn" role="alert">We could not reach the portal. Check your connection and try again.</p>';
    }
  });

  // Show the chosen file name next to a file input (helps on mobile where the control is terse).
  document.addEventListener("change", function (event) {
    var input = event.target;
    if (input.matches && input.matches("input[type=file][data-names]")) {
      var out = document.getElementById(input.getAttribute("data-names"));
      if (out) out.textContent = input.files.length ? input.files[0].name : "";
    }
  });
})();
