// Billing invoice editor: a live preview of line amounts and totals while typing.
// Display only: the server recomputes every total in integer pence when the draft is saved.
(function () {
  "use strict";
  var editor = document.querySelector("[data-invoice-editor]");
  if (!editor) return;
  var vatRate = Number(editor.getAttribute("data-vat-rate") || "0") || 0;

  function money(pence) {
    var sign = pence < 0 ? "−" : "";
    var abs = Math.abs(pence);
    var pounds = Math.floor(abs / 100);
    var rest = abs % 100;
    return sign + "£" + pounds.toLocaleString("en-GB") + "." + (rest < 10 ? "0" : "") + rest;
  }

  function number(input, fallback) {
    if (!input || input.value.trim() === "") return fallback;
    var value = Number(input.value.replace(/[£,\s]/g, ""));
    return isFinite(value) ? value : NaN;
  }

  function set(selector, text) {
    var element = editor.querySelector(selector);
    if (element) element.textContent = text;
  }

  function update() {
    var subtotal = 0;
    editor.querySelectorAll("[data-line]").forEach(function (row) {
      var output = row.querySelector("[data-line-amount]");
      var remove = row.querySelector("input[name$='-DELETE']");
      var quantity = number(row.querySelector("input[name$='-quantity']"), 1);
      var price = number(row.querySelector("input[name$='-unit_price']"), NaN);
      if (isNaN(price) || isNaN(quantity) || (remove && remove.checked)) {
        if (output) output.textContent = "—";
        return;
      }
      // Half up to the penny, as the server does (the epsilon absorbs binary floating point).
      var amount = Math.round(quantity * Math.round(price * 100) + 1e-6);
      subtotal += amount;
      if (output) output.textContent = money(amount);
    });
    var vat = vatRate ? Math.round((subtotal * vatRate) / 100 + 1e-6) : 0;
    set("[data-preview-subtotal]", money(subtotal));
    set("[data-preview-vat]", money(vat));
    set("[data-preview-total]", money(subtotal + vat));
  }

  editor.addEventListener("input", update);
  editor.addEventListener("change", update);
  update();
})();
