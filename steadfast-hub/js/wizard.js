/* Steadfast Hub — shared transaction wizard engine.
   A page defines window.WIZARD before loading this script:

   {
     kicker, title, intro,
     sampleDocs: ["Purchase Agreement.pdf", ...],
     confirmIntro,
     confirmFields: [
       { id, label, type: "text"|"date"|"select", value, source, required, hint, options }
       // source = document tag the value was read from; omit/null = starts blank
     ],
     questions: [
       { id, label, type: "choice"|"text"|"date"|"textarea"|"select",
         options, required, hint,
         reveals: { "<answer value>": [ subfield defs like confirmFields ] } }
     ],
     stats: { asked, instead },   // "About {asked} questions instead of {instead}"
     successTitle, successBody
   }
*/
(function () {
  var W = window.WIZARD;
  var root = document.getElementById("wizard-root");
  var STEPS = ["Documents", "Confirm", "Questions", "Review", "Done"];
  var state = { step: 0, values: {} };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function stepper() {
    return (
      '<div class="stepper">' +
      STEPS.map(function (s, i) {
        var cls = i === state.step ? "now" : i < state.step ? "done" : "";
        return '<span class="st ' + cls + '">' + (i + 1) + " · " + s + "</span>";
      }).join("") +
      "</div>"
    );
  }

  function fieldHtml(f, val) {
    var v = val != null ? val : f.value != null ? f.value : "";
    var tag =
      f.source
        ? '<span class="src-tag">' + esc(f.source) + "</span>"
        : f.sourceBlank
        ? '<span class="src-tag blank">not found in docs</span>'
        : "";
    var req = f.required ? ' <span class="req">*</span>' : "";
    var inner;
    if (f.type === "select") {
      inner =
        '<select id="f-' + f.id + '" data-fid="' + f.id + '">' +
        '<option value="">Select…</option>' +
        (f.options || []).map(function (o) {
          return '<option' + (v === o ? " selected" : "") + ">" + esc(o) + "</option>";
        }).join("") +
        "</select>";
    } else if (f.type === "textarea") {
      inner = '<textarea id="f-' + f.id + '" data-fid="' + f.id + '">' + esc(v) + "</textarea>";
    } else {
      inner =
        '<input type="' + (f.type === "date" ? "date" : "text") + '" id="f-' + f.id +
        '" data-fid="' + f.id + '" value="' + esc(v) + '">';
    }
    return (
      '<div class="field" data-wrap="' + f.id + '">' +
      '<label for="f-' + f.id + '">' + esc(f.label) + req + tag + "</label>" +
      inner +
      (f.hint ? '<div class="hint">' + esc(f.hint) + "</div>" : "") +
      '<div class="err">This field is required.</div>' +
      "</div>"
    );
  }

  function choiceHtml(q, val) {
    return (
      '<div class="choice-row" data-fid="' + q.id + '">' +
      (q.options || []).map(function (o) {
        var id = "c-" + q.id + "-" + o.replace(/\W+/g, "");
        return (
          '<label class="chip"><input type="radio" name="q-' + q.id + '" value="' + esc(o) +
          '"' + (val === o ? " checked" : "") + '><span>' + esc(o) + "</span></label>"
        );
      }).join("") +
      "</div>"
    );
  }

  function questionHtml(q) {
    var val = state.values[q.id];
    var req = q.required ? ' <span class="req">*</span>' : "";
    var body =
      q.type === "choice"
        ? choiceHtml(q, val)
        : fieldHtml({ id: q.id, label: "", type: q.type, options: q.options }, val).replace(/<label[^>]*><\/label>/, "");
    var reveals = "";
    if (q.reveals) {
      Object.keys(q.reveals).forEach(function (ans) {
        reveals +=
          '<div class="conditional' +
          (val === ans ? " show" : "") +
          '" data-reveal-for="' + q.id + '" data-reveal-on="' + esc(ans) + '">' +
          q.reveals[ans].map(function (sf) { return fieldHtml(sf, state.values[sf.id]); }).join("") +
          "</div>";
      });
    }
    return (
      '<div class="field" data-wrap="' + q.id + '">' +
      '<label>' + esc(q.label) + req + "</label>" +
      body +
      (q.hint ? '<div class="hint">' + esc(q.hint) + "</div>" : "") +
      '<div class="err">Please answer this question.</div>' +
      "</div>" +
      reveals
    );
  }

  /* ---------- step renderers ---------- */

  function renderDocs() {
    root.innerHTML =
      stepper() +
      '<div class="dropzone">' +
      '<div class="dz-title">Drop your transaction documents here</div>' +
      '<div class="dz-hint">PDF, DOCX or photos. We read them so you type less.</div>' +
      '<button class="btn btn-navy" id="fake-upload">Choose files</button>' +
      '<div style="margin-top:18px"><button class="linklike" id="use-samples">Use sample documents instead</button></div>' +
      "</div>";
    document.getElementById("use-samples").addEventListener("click", startReading);
    document.getElementById("fake-upload").addEventListener("click", startReading);
  }

  function startReading() {
    root.innerHTML =
      stepper() +
      '<div class="card loading-panel">' +
      '<div class="beam"></div>' +
      '<div class="lp-title">Reading your documents…</div>' +
      '<div class="lp-sub">' +
      W.sampleDocs.map(esc).join(" · ") +
      "</div></div>";
    setTimeout(function () {
      state.step = 1;
      renderConfirm();
    }, 3000);
  }

  function renderConfirm() {
    root.innerHTML =
      stepper() +
      '<div class="card">' +
      "<h2>Confirm what we found</h2>" +
      '<p class="lede" style="margin-bottom:20px">' + esc(W.confirmIntro || "We pre-filled these from your documents. Fix anything that looks off, and fill in the blanks.") + "</p>" +
      W.confirmFields.map(function (f) { return fieldHtml(f, state.values[f.id]); }).join("") +
      '<div class="wizard-nav"><button class="linklike" id="back">Back</button>' +
      '<button class="btn btn-navy" id="next">Looks right — continue</button></div>' +
      "</div>";
    document.getElementById("back").addEventListener("click", function () { state.step = 0; renderDocs(); });
    document.getElementById("next").addEventListener("click", function () {
      captureInputs();
      if (validate(W.confirmFields)) { state.step = 2; renderQuestions(); window.scrollTo(0, 0); }
    });
  }

  function renderQuestions() {
    root.innerHTML =
      stepper() +
      '<div class="card">' +
      "<h2>A few questions</h2>" +
      W.questions.map(questionHtml).join("") +
      '<div class="wizard-nav"><button class="linklike" id="back">Back</button>' +
      '<button class="btn btn-navy" id="next">Continue to review</button></div>' +
      "</div>";
    root.querySelectorAll('input[type="radio"]').forEach(function (r) {
      r.addEventListener("change", function () {
        var qid = r.name.replace(/^q-/, "");
        state.values[qid] = r.value;
        root.querySelectorAll('[data-reveal-for="' + qid + '"]').forEach(function (c) {
          c.classList.toggle("show", c.getAttribute("data-reveal-on") === r.value);
        });
      });
    });
    document.getElementById("back").addEventListener("click", function () {
      captureInputs(); state.step = 1; renderConfirm(); window.scrollTo(0, 0);
    });
    document.getElementById("next").addEventListener("click", function () {
      captureInputs();
      if (validateQuestions()) { state.step = 3; renderReview(); window.scrollTo(0, 0); }
    });
  }

  function activeSubfields() {
    var subs = [];
    W.questions.forEach(function (q) {
      if (q.reveals && q.reveals[state.values[q.id]]) subs = subs.concat(q.reveals[state.values[q.id]]);
    });
    return subs;
  }

  function renderReview() {
    function rows(list) {
      return list
        .map(function (f) {
          var v = state.values[f.id];
          if (v == null || v === "") return "";
          return '<li><span class="k">' + esc(f.label) + '</span><span class="v">' + esc(v) + "</span></li>";
        })
        .join("");
    }
    root.innerHTML =
      stepper() +
      '<div class="card">' +
      "<h2>Final review</h2>" +
      '<div class="review-section-title">From your documents</div>' +
      '<ul class="review-list">' + rows(W.confirmFields) + "</ul>" +
      '<div class="review-section-title">Your answers</div>' +
      '<ul class="review-list">' + rows(W.questions) + rows(activeSubfields()) + "</ul>" +
      '<div class="wizard-nav"><button class="linklike" id="back">Back</button>' +
      '<button class="btn btn-gold" id="submit">Submit</button></div>' +
      "</div>";
    document.getElementById("back").addEventListener("click", function () { state.step = 2; renderQuestions(); window.scrollTo(0, 0); });
    document.getElementById("submit").addEventListener("click", function () { state.step = 4; renderDone(); window.scrollTo(0, 0); });
  }

  function renderDone() {
    root.innerHTML =
      stepper() +
      '<div class="card success-panel">' +
      '<img class="mark" src="assets/flag-badge-gold.svg" alt="Steadfast mark">' +
      "<h2>" + esc(W.successTitle || "Submitted") + "</h2>" +
      '<p class="lede" style="margin:10px auto 0">' + esc(W.successBody || "Our team has everything it needs. We'll take it from here.") + "</p>" +
      (W.stats
        ? '<div class="stat">About <b>' + W.stats.asked + "</b> questions instead of <b>" + W.stats.instead + "</b> — your documents did the rest.</div>"
        : "") +
      '<div style="margin-top:28px"><a class="btn btn-ghost" href="transaction-services.html">Back to Transaction Services</a></div>' +
      "</div>";
    launchConfetti();
  }

  /* ---------- helpers ---------- */

  function captureInputs() {
    root.querySelectorAll("[data-fid]").forEach(function (el) {
      if (el.classList.contains("choice-row")) return;
      state.values[el.getAttribute("data-fid")] = el.value;
    });
  }

  function markInvalid(id, bad) {
    var wrap = root.querySelector('[data-wrap="' + id + '"]');
    if (wrap) wrap.classList.toggle("invalid", bad);
  }

  function validate(fields) {
    var ok = true;
    fields.forEach(function (f) {
      var bad = f.required && !(state.values[f.id] || "").trim();
      markInvalid(f.id, bad);
      if (bad) ok = false;
    });
    return ok;
  }

  function validateQuestions() {
    var ok = validate(W.questions);
    if (!validate(activeSubfields())) ok = false;
    return ok;
  }

  /* ---------- boot ---------- */
  var head = document.getElementById("wizard-head");
  if (head) {
    var words = esc(W.title).trim().split(/\s+/);
    var lastWord = words.pop();
    if (!/[.!?]$/.test(lastWord)) lastWord += ".";
    head.innerHTML =
      '<p class="kicker">' + esc(W.kicker || "Transaction Services") + "</p>" +
      "<h1>" + (words.length ? words.join(" ") + " " : "") + '<span class="au">' + lastWord + "</span></h1>" +
      '<p class="lede">' + esc(W.intro || "") + "</p>";
  }
  renderDocs();
})();
