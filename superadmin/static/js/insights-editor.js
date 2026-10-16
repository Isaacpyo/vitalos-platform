// Insights post editor: Markdown toolbar and shortcuts, autosave with conflict detection, Write /
// Preview / Split, image paste and drop (alt text first), counters and the search-result preview.
// Loaded as an external file with the page's CSP nonce; it never evaluates HTML from the server.
(function () {
  "use strict";

  var form = document.getElementById("post-form");
  if (!form) return;
  var editable = form.hasAttribute("data-editable");
  var body = form.querySelector("[data-md-editor]") || document.querySelector("[data-md-editor]");
  var statusEl = document.getElementById("autosave-status");
  var conflictEl = document.querySelector("[data-conflict]");
  var csrf = form.querySelector("input[name=csrfmiddlewaretoken]");
  var dirty = false;
  var saving = null;
  var conflict = false;
  var AUTOSAVE_MS = 10000;

  function token() {
    return csrf ? csrf.value : "";
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function toast(message) {
    document.dispatchEvent(new CustomEvent("vsa-toast", { detail: { message: message } }));
  }

  // --- Autosave ------------------------------------------------------------------------------------

  function field(name) {
    return form.elements.namedItem(name);
  }

  function save() {
    if (!editable || conflict) return Promise.resolve(false);
    if (saving) return saving;
    if (!dirty) return Promise.resolve(true);
    dirty = false;
    setStatus("Saving…");
    var data = new FormData(form);
    saving = fetch(form.getAttribute("data-autosave-url"), {
      method: "POST",
      body: data,
      credentials: "same-origin",
      headers: { "X-CSRFToken": token(), "X-Requested-With": "fetch" },
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          return { status: response.status, payload: payload };
        });
      })
      .then(function (result) {
        var payload = result.payload || {};
        if (result.status === 200 && payload.ok) {
          field("updated_at").value = payload.updatedAt;
          field("force").value = "";
          setStatus(payload.savedAt);
          var reading = document.querySelector("[data-reading]");
          if (reading) reading.textContent = payload.readingMinutes + " min read";
          var notes = document.querySelector("[data-slug-notes]");
          if (notes) {
            notes.textContent = "";
            (payload.slugNotes || []).forEach(function (note) {
              var p = document.createElement("p");
              p.className = "mt-1 text-xs font-medium text-slate-800 dark:text-slate-100";
              p.setAttribute("role", "note");
              p.textContent = note;
              notes.appendChild(p);
            });
          }
          document.body.dispatchEvent(new CustomEvent("vsa-post-saved", { bubbles: true }));
          return true;
        }
        if (result.status === 409) {
          conflict = true;
          dirty = true;
          if (conflictEl) conflictEl.hidden = false;
          setStatus("Not saved: newer version exists");
          return false;
        }
        dirty = true;
        var errors = payload.errors || {};
        var first = Object.keys(errors)[0];
        setStatus("Not saved");
        toast(first ? [].concat(errors[first]).join(" ") : payload.error || "The post could not be saved.");
        return false;
      })
      .catch(function () {
        dirty = true;
        setStatus("Not saved: offline");
        return false;
      })
      .finally(function () {
        saving = null;
      });
    return saving;
  }

  function markDirty() {
    if (!editable) return;
    dirty = true;
    setStatus("Unsaved changes");
  }

  if (editable) {
    document.addEventListener("input", function (event) {
      if (event.target.form === form) markDirty();
      updateCounters(event.target);
      updateSeoPreview();
    });
    document.addEventListener("change", function (event) {
      if (event.target.form === form) markDirty();
    });
    document.addEventListener("focusout", function (event) {
      if (event.target.form === form && dirty) save();
    });
    window.setInterval(function () {
      if (dirty) save();
    }, AUTOSAVE_MS);
    window.addEventListener("beforeunload", function (event) {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    });
    form.addEventListener("submit", function (event) {
      // With JavaScript the Save button saves in place.
      event.preventDefault();
      dirty = true;
      save();
    });
    // Actions (publish, checks, schedule, cover) save pending edits first, so a check is never ticked
    // on an older version than the one on screen.
    document.addEventListener(
      "submit",
      function (event) {
        var target = event.target;
        if (!target.hasAttribute || !target.hasAttribute("data-flush") || (!dirty && !saving)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        save().then(function (ok) {
          if (ok) target.requestSubmit();
        });
      },
      true,
    );
    document.addEventListener(
      "click",
      function (event) {
        var link = event.target.closest && event.target.closest("[data-flush-link]");
        if (link && (dirty || saving)) {
          event.preventDefault();
          var opened = window.open("about:blank", "_blank", "noopener");
          save().then(function () {
            if (opened) opened.location = link.href;
            else window.location = link.href;
          });
        }
      },
      true,
    );
    var keep = document.querySelector("[data-keep-mine]");
    if (keep) {
      keep.addEventListener("click", function () {
        conflict = false;
        dirty = true;
        field("force").value = "true";
        if (conflictEl) conflictEl.hidden = true;
        save();
      });
    }
  }

  // --- Counters and the search-result preview ---------------------------------------------------

  function updateCounters(target) {
    if (!target || !target.id) return;
    var counter = document.querySelector('[data-counter-for="' + target.id + '"]');
    var max = target.getAttribute("data-counter");
    if (counter && max) counter.textContent = target.value.length + " / " + max;
  }

  function updateSeoPreview() {
    var title = field("seo_title").value || field("title").value;
    var description = field("seo_description").value || field("excerpt").value;
    var slug = field("slug").value;
    var map = { "[data-seo-title]": title, "[data-seo-description]": description, "[data-seo-slug]": slug, "[data-slug-mirror]": slug };
    Object.keys(map).forEach(function (selector) {
      document.querySelectorAll(selector).forEach(function (element) {
        element.textContent = map[selector];
      });
    });
  }

  // --- Markdown toolbar -------------------------------------------------------------------------

  function replaceSelection(before, after, placeholder) {
    var start = body.selectionStart;
    var end = body.selectionEnd;
    var selected = body.value.slice(start, end) || placeholder || "";
    var text = before + selected + (after || "");
    body.setRangeText(text, start, end, "end");
    if (!body.value.slice(start, end) && placeholder) {
      body.setSelectionRange(start + before.length, start + before.length + selected.length);
    }
    body.focus();
    body.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function prefixLines(prefix) {
    var start = body.value.lastIndexOf("\n", body.selectionStart - 1) + 1;
    var end = body.selectionEnd;
    var block = body.value.slice(start, end) || "Text";
    var lines = block.split("\n").map(function (line, index) {
      return (typeof prefix === "function" ? prefix(index) : prefix) + line;
    });
    body.setRangeText(lines.join("\n"), start, end, "end");
    body.focus();
    body.dispatchEvent(new Event("input", { bubbles: true }));
  }

  var footnoteCount = 0;
  var actions = {
    h2: function () { prefixLines("## "); },
    h3: function () { prefixLines("### "); },
    h4: function () { prefixLines("#### "); },
    bold: function () { replaceSelection("**", "**", "bold text"); },
    italic: function () { replaceSelection("_", "_", "italic text"); },
    link: function () { replaceSelection("[", "](https://)", "link text"); },
    ul: function () { prefixLines("- "); },
    ol: function () { prefixLines(function (index) { return index + 1 + ". "; }); },
    quote: function () { prefixLines("> "); },
    code: function () { replaceSelection("\n```\n", "\n```\n", "code"); },
    table: function () { replaceSelection("\n| Column | Column |\n| --- | --- |\n| ", " | Value |\n", "Value"); },
    footnote: function () {
      footnoteCount += 1;
      var label = "note" + footnoteCount;
      replaceSelection("", "[^" + label + "]", "");
      body.value = body.value.replace(/\s*$/, "") + "\n\n[^" + label + "]: Source\n";
      body.dispatchEvent(new Event("input", { bubbles: true }));
    },
    callout: function () { prefixLines(function (index) { return index === 0 ? "> [!NOTE]\n> " : "> "; }); },
    image: function () { pickImage(); },
  };

  document.querySelectorAll("[data-md-action]").forEach(function (button) {
    button.addEventListener("click", function () {
      var action = actions[button.getAttribute("data-md-action")];
      if (action && editable) action();
    });
  });

  if (body && editable) {
    body.addEventListener("keydown", function (event) {
      var mod = event.metaKey || event.ctrlKey;
      if (!mod) return;
      var key = event.key.toLowerCase();
      var map = { b: "bold", i: "italic", k: "link" };
      if (map[key] && !event.shiftKey && !event.altKey) {
        event.preventDefault();
        event.stopPropagation();
        actions[map[key]]();
      } else if (key === "s") {
        event.preventDefault();
        event.stopPropagation();
        dirty = true;
        save();
      }
    });
  }

  // --- Images: paste, drop or pick; alt text first ------------------------------------------------

  function upload(file) {
    if (!file || !/^image\/(jpeg|png|webp|avif)$/.test(file.type)) {
      toast("Use a JPEG, PNG, WebP or AVIF image.");
      return;
    }
    var alt = window.prompt("Describe the image for people who cannot see it (alt text):", "");
    if (alt === null) return;
    alt = alt.trim();
    if (!alt) {
      toast("Alt text is required for every image.");
      return;
    }
    var data = new FormData();
    data.append("image", file);
    data.append("alt", alt);
    setStatus("Uploading image…");
    fetch(form.getAttribute("data-media-url"), {
      method: "POST",
      body: data,
      credentials: "same-origin",
      headers: { "X-CSRFToken": token() },
    })
      .then(function (response) {
        return response.json().then(function (payload) {
          return { status: response.status, payload: payload };
        });
      })
      .then(function (result) {
        if (result.status === 201) {
          replaceSelection("\n" + result.payload.markdown + "\n", "", "");
          setStatus("Image uploaded");
        } else {
          setStatus("Image not uploaded");
          toast(result.payload.error || "The image could not be uploaded.");
        }
      })
      .catch(function () {
        toast("The image could not be uploaded. Check your connection.");
      });
  }

  function pickImage() {
    var input = document.createElement("input");
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp,image/avif";
    input.addEventListener("change", function () {
      if (input.files && input.files[0]) upload(input.files[0]);
    });
    input.click();
  }

  if (body && editable && form.getAttribute("data-media-url")) {
    body.addEventListener("paste", function (event) {
      var items = (event.clipboardData && event.clipboardData.files) || [];
      if (items.length) {
        event.preventDefault();
        upload(items[0]);
      }
    });
    body.addEventListener("dragover", function (event) {
      if (event.dataTransfer && Array.prototype.indexOf.call(event.dataTransfer.types, "Files") >= 0) {
        event.preventDefault();
      }
    });
    body.addEventListener("drop", function (event) {
      var files = event.dataTransfer && event.dataTransfer.files;
      if (files && files.length) {
        event.preventDefault();
        upload(files[0]);
      }
    });
  }

  // --- Write / Preview / Split -------------------------------------------------------------------

  var tabs = document.querySelector("[data-md-tabs]");
  var panes = document.querySelector("[data-md-panes]");
  var previewPane = document.querySelector("[data-md-preview]");
  var writePane = document.querySelector("[data-md-write]");
  var panel = document.getElementById("preview-panel");

  function loadPreview() {
    if (!panel || !window.htmx) return;
    save().then(function () {
      window.htmx.ajax("GET", form.getAttribute("data-preview-url"), { target: "#preview-panel", swap: "innerHTML" });
    });
  }

  function setView(view) {
    if (!panes) return;
    panes.setAttribute("data-view", view);
    tabs.querySelectorAll("[data-md-view]").forEach(function (tab) {
      tab.setAttribute("aria-selected", tab.getAttribute("data-md-view") === view ? "true" : "false");
    });
    writePane.hidden = view === "preview";
    previewPane.hidden = view === "write";
    panes.classList.toggle("lg:grid-cols-2", view === "split");
    previewPane.classList.toggle("lg:border-l", view === "split");
    previewPane.classList.toggle("lg:border-t-0", view === "split");
    if (view !== "write") loadPreview();
  }

  if (tabs && panes) {
    tabs.classList.remove("hidden");
    tabs.classList.add("flex");
    tabs.querySelectorAll("[data-md-view]").forEach(function (tab) {
      tab.addEventListener("click", function () {
        setView(tab.getAttribute("data-md-view"));
      });
    });
    document.body.addEventListener("vsa-post-saved", function () {
      if (panes.getAttribute("data-view") === "split" && panel && window.htmx) {
        window.htmx.ajax("GET", form.getAttribute("data-preview-url"), { target: "#preview-panel", swap: "innerHTML" });
      }
    });
  }
})();
