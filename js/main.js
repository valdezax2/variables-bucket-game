// App controller: screens, intro validation, level lifecycle,
// lesson modal, password gate, level 2 placeholder.

(function () {
  "use strict";

  const $ = (sel) => document.querySelector(sel);

  // ---- state ----
  const state = {
    name: "",
    id: "",
    password: "",      // level-1 -> level-2 unlock password
    classroomCode: "", // submitted to Google Classroom
    level1Done: false,
  };

  // ---- screen switching ----
  const screens = {
    intro: $("#screen-intro"),
    game: $("#screen-game"),
    gate: $("#screen-gate"),
    level2: $("#screen-level2"),
  };
  function showScreen(key) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[key].classList.add("active");
  }

  // ---- intro ----
  const nameInput = $("#name-input");
  const idInput = $("#id-input");
  const btnStart = $("#btn-start");
  const introError = $("#intro-error");

  function validateIntro() {
    const name = nameInput.value.trim();
    const idRaw = idInput.value.trim();
    const id = parseInt(idRaw, 10);
    let err = "";
    if (name.length < 2) err = "Please enter your first name.";
    else if (!idRaw || Number.isNaN(id) || id < 1 || id > 28) err = "Student ID must be a number from 1 to 28.";
    introError.hidden = !err;
    introError.textContent = err;
    btnStart.disabled = !!err;
    return !err;
  }

  [nameInput, idInput].forEach((el) =>
    el.addEventListener("input", validateIntro)
  );
  [nameInput, idInput].forEach((el) =>
    el.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !btnStart.disabled) btnStart.click();
    })
  );

  btnStart.addEventListener("click", () => {
    if (!validateIntro()) return;
    state.name = nameInput.value.trim();
    state.id = idInput.value.trim();
    state.password = Seed.deriveLevelPassword(state.name, state.id, 2);
    state.classroomCode = Seed.deriveClassroomCode(state.name, state.id);
    $("#hud-name").textContent = state.name + " #" + state.id;
    $("#hud-name2").textContent = state.name + " #" + state.id;
    startLevel1();
  });

  // ---- level 1 ----
  let level1 = null;
  function startLevel1() {
    showScreen("game");
    // wait a frame so the room has its final size before we measure
    requestAnimationFrame(() => {
      level1 = new Level1(screens.game, {
        player: { name: state.name, id: state.id },
        onProgress: (done, total) => {
          $("#hud-progress-fill").style.width = total ? (done / total) * 100 + "%" : "0%";
          $("#hud-progress-label").textContent = done + " / " + total + " in bucket";
        },
        onComplete: () => {
          state.level1Done = true;
          openLesson();
        },
      });
    });
  }

  $("#btn-reset").addEventListener("click", () => {
    if (level1 && !state.level1Done) level1.reset();
  });

  // Keep seated bucket aligned on resize
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => level1 && level1.handleResize(), 120);
  });

  // ---- lesson modal ----
  const lessonModal = $("#lesson-modal");
  function openLesson() {
    $("#lesson-password").textContent = state.password;
    lessonModal.hidden = false;
    // scroll lesson to top
    lessonModal.querySelector(".lesson-scroll").scrollTop = 0;
  }
  $("#btn-lesson-done").addEventListener("click", () => {
    lessonModal.hidden = true;
    showScreen("gate");
    const gi = $("#gate-input");
    gi.value = "";
    $("#gate-error").hidden = true;
    gi.focus();
  });

  // ---- password gate ----
  const gateInput = $("#gate-input");
  const gateError = $("#gate-error");
  function checkGate() {
    const val = gateInput.value.trim().toUpperCase();
    if (val === state.password.toUpperCase()) {
      gateError.hidden = true;
      startLevel2();
    } else {
      gateError.hidden = false;
      gateError.textContent = "That's not it. Check your notes and try again.";
    }
  }
  $("#btn-gate").addEventListener("click", checkGate);
  gateInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") checkGate();
  });

  // ---- level 2 ----
  let level2 = null;
  function startLevel2() {
    showScreen("level2");
    if (level2) return; // guard against double-init
    requestAnimationFrame(() => {
      if (level2) return;
      level2 = new Level2(screens.level2, {
        player: { name: state.name, id: state.id },
        onProgress: (done, total) => {
          $("#hud-progress2-fill").style.width = total ? (done / total) * 100 + "%" : "0%";
          $("#hud-progress2-label").textContent = done + " / " + total + " sorted";
        },
        onComplete: () => openLesson2(),
      });
    });
  }

  // ---- lesson 2 modal (naming + types + worksheet) ----
  const lessonModal2 = $("#lesson-modal-2");
  const raiseHandBtn = $("#btn-raise-hand");
  const wsName = $("#ws-name");
  const wsWhy = $("#ws-why");

  // populate worksheet picture items
  (function buildWorksheet() {
    const WS = [
      { emoji: "🐶", tag: "dog" }, { emoji: "🐱", tag: "cat" },
      { emoji: "🐦", tag: "bird" }, { emoji: "🏠", tag: "house" },
      { emoji: "🚗", tag: "car" }, { emoji: "📱", tag: "phone" },
      { emoji: "🍕", tag: "pizza" }, { emoji: "☂️", tag: "umbrella" },
      { emoji: "🎮", tag: "game" }, { emoji: "⚽", tag: "ball" },
    ];
    const box = $("#worksheet-items");
    box.innerHTML = WS.map((it) =>
      '<div class="ws-item"><div class="emoji">' + it.emoji + '</div><div class="tag">' + it.tag + "</div></div>"
    ).join("");
  })();

  function wsComplete() {
    raiseHandBtn.disabled = !(wsName.value.trim() && wsWhy.value.trim());
  }
  wsName.addEventListener("input", wsComplete);
  wsWhy.addEventListener("input", wsComplete);

  function openLesson2() {
    wsName.value = "";
    wsWhy.value = "";
    wsComplete();
    lessonModal2.hidden = false;
    lessonModal2.querySelector(".lesson-scroll").scrollTop = 0;
  }

  raiseHandBtn.addEventListener("click", () => {
    // Teacher checks the work, then the code is revealed.
    lessonModal2.hidden = true;
    $("#classroom-code").textContent = state.classroomCode;
    $("#completion-modal").hidden = false;
  });

  $("#btn-copy-code").addEventListener("click", () => {
    const code = state.classroomCode;
    const btn = $("#btn-copy-code");
    function done() {
      btn.textContent = "Copied!";
      btn.classList.add("copied");
      setTimeout(() => { btn.textContent = "Copy code"; btn.classList.remove("copied"); }, 1500);
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(done).catch(done);
    } else { done(); }
  });

  $("#btn-back-home").addEventListener("click", () => {
    state.level1Done = false;
    level2 = null;
    nameInput.value = state.name;
    idInput.value = state.id;
    $("#completion-modal").hidden = true;
    showScreen("intro");
    validateIntro();
  });

  // ---- init ----
  validateIntro();
  nameInput.focus();
})();
