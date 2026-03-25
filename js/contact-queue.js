(function () {
  var STORAGE_KEY = "mm_portfolio_contact_queue_v1";
  var MAX_SEND_ATTEMPTS = 8;

  function uuid() {
    if (typeof crypto !== "undefined" && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function getEndpoint() {
    return (window.PORTFOLIO_FORM_ENDPOINT || "").trim();
  }

  function loadQueue() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function saveQueue(items) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
    } catch (e) {
      /* quota */
    }
    updatePendingUi();
  }

  function enqueue(record) {
    var q = loadQueue();
    record.id = record.id || uuid();
    record.createdAt = record.createdAt || Date.now();
    record.attempts = record.attempts || 0;
    q.push(record);
    saveQueue(q);
  }

  function removeById(id) {
    saveQueue(loadQueue().filter(function (x) {
      return x.id !== id;
    }));
  }

  function sendPayload(payload) {
    var endpoint = getEndpoint();
    if (!endpoint) {
      var ne = new Error("NO_ENDPOINT");
      ne.code = "NO_ENDPOINT";
      return Promise.reject(ne);
    }
    return fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        name: payload.name,
        email: payload.email,
        message: payload.message,
        _subject: "Portfolio: contact request",
        _replyto: payload.email,
      }),
    }).then(function (res) {
      if (!res.ok) {
        var err = new Error("HTTP " + res.status);
        err.status = res.status;
        return Promise.reject(err);
      }
      return res.json().catch(function () {
        return {};
      });
    });
  }

  function isValidEmail(s) {
    if (!s || s.length > 254) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s);
  }

  function clearFieldInvalid(form) {
    if (!form) return;
    form.querySelectorAll(".contact-form__input--invalid").forEach(function (el) {
      el.classList.remove("contact-form__input--invalid");
      el.removeAttribute("aria-invalid");
    });
  }

  function clearFormStatus(el) {
    if (!el) return;
    el.hidden = true;
    el.textContent = "";
    el.className = "contact-form-status";
  }

  function updatePendingUi() {
    var n = loadQueue().length;
    var badge = document.getElementById("contact-queue-badge");
    var note = document.getElementById("contact-queue-note");
    if (badge) {
      badge.hidden = n === 0;
      badge.textContent = n === 1 ? "1 saved offline" : n + " saved offline";
    }
    if (note) {
      note.hidden = n === 0;
    }
  }

  function flushQueue() {
    if (!navigator.onLine) return;
    if (!getEndpoint()) return;

    var q = loadQueue();
    if (!q.length) return;

    var remaining = [];
    var i = 0;

    function tryNext() {
      if (i >= q.length) {
        saveQueue(remaining);
        updatePendingUi();
        return;
      }
      var item = q[i++];
      sendPayload(item.payload).then(
        function () {
          tryNext();
        },
        function () {
          item.attempts = (item.attempts || 0) + 1;
          if (item.attempts < MAX_SEND_ATTEMPTS) remaining.push(item);
          tryNext();
        }
      );
    }

    tryNext();
  }

  function showFormStatus(el, type, text) {
    if (!el) return;
    el.hidden = false;
    el.className = "contact-form-status contact-form-status--" + type;
    el.textContent = text;
  }

  function openModal() {
    var modal = document.getElementById("contact-request-modal");
    var form = document.getElementById("contact-request-form");
    var statusEl = document.getElementById("contact-form-status");
    if (!modal) return;
    clearFormStatus(statusEl);
    clearFieldInvalid(form);
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    var first =
      modal.querySelector('input[name="name"]') ||
      modal.querySelector("textarea");
    if (first) first.focus();
    updatePendingUi();
  }

  function closeModal() {
    var modal = document.getElementById("contact-request-modal");
    var form = document.getElementById("contact-request-form");
    var statusEl = document.getElementById("contact-form-status");
    if (!modal) return;
    clearFormStatus(statusEl);
    clearFieldInvalid(form);
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function bindModal() {
    var modal = document.getElementById("contact-request-modal");
    var form = document.getElementById("contact-request-form");
    var statusEl = document.getElementById("contact-form-status");
    var openers = document.querySelectorAll("[data-open-contact-request]");

    openers.forEach(function (btn) {
      btn.addEventListener("click", function () {
        openModal();
      });
    });

    if (modal) {
      modal.addEventListener("click", function (e) {
        if (e.target === modal) closeModal();
        else if (e.target.closest && e.target.closest("[data-close-modal]")) {
          closeModal();
        }
      });
    }

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && modal && !modal.hidden) closeModal();
    });

    if (!form) return;

    form.addEventListener("input", function () {
      clearFieldInvalid(form);
      if (statusEl && !statusEl.hidden) {
        if (
          statusEl.className.indexOf("contact-form-status--error") !== -1
        ) {
          clearFormStatus(statusEl);
        }
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      clearFormStatus(statusEl);
      clearFieldInvalid(form);

      var fd = new FormData(form);
      var emailInput = form.querySelector('input[name="email"]');
      var payload = {
        name: (fd.get("name") || "").toString().trim(),
        email: (fd.get("email") || "").toString().trim(),
        message: (fd.get("message") || "").toString().trim(),
      };

      if (!payload.name || !payload.email || !payload.message) {
        showFormStatus(
          statusEl,
          "error",
          "Please fill in name, email, and message."
        );
        return;
      }

      if (!isValidEmail(payload.email)) {
        if (emailInput) {
          emailInput.classList.add("contact-form__input--invalid");
          emailInput.setAttribute("aria-invalid", "true");
        }
        showFormStatus(
          statusEl,
          "error",
          "Please enter a valid email address (e.g. name@example.com)."
        );
        return;
      }

      if (payload.message.length < 3) {
        showFormStatus(
          statusEl,
          "error",
          "Message is too short — please write at least a few characters."
        );
        return;
      }

      var endpoint = getEndpoint();

      function savedLocalOnly(msg) {
        enqueue({ payload: payload });
        showFormStatus(statusEl, "pending", msg);
        form.reset();
        clearFieldInvalid(form);
        updatePendingUi();
      }

      if (!navigator.onLine) {
        savedLocalOnly(
          "You are offline. The request is saved in this browser and will be sent when you are online."
        );
        return;
      }

      if (!endpoint) {
        savedLocalOnly(
          "No server URL configured yet — saved only in this browser. Add your Formspree URL in js/config.js to receive emails."
        );
        return;
      }

      sendPayload(payload).then(
        function () {
          showFormStatus(
            statusEl,
            "ok",
            "Thank you — your message was sent. I will get back to you soon."
          );
          form.reset();
          clearFieldInvalid(form);
        },
        function (err) {
          var st = err && err.status;
          if (err && err.code === "NO_ENDPOINT") {
            savedLocalOnly(
              "No server URL configured — saved only in this browser."
            );
            return;
          }
          if (st >= 400 && st < 500) {
            showFormStatus(
              statusEl,
              "error",
              "The form could not be accepted. Check your email and message, then try again."
            );
            return;
          }
          enqueue({ payload: payload });
          showFormStatus(
            statusEl,
            "pending",
            "Could not send right now. Your request is saved and will retry automatically."
          );
          updatePendingUi();
        }
      );
    });
  }

  window.addEventListener("online", flushQueue);
  document.addEventListener("DOMContentLoaded", function () {
    bindModal();
    updatePendingUi();
    flushQueue();
  });
})();
