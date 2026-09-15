// Level 2 — "Name the Bucket"
// A rack of 20 items across 5 categories. Students add unlimited buckets,
// label each with a category (which names it as a variable), then drag items
// in. An item is accepted only if its category matches the bucket's label.
// Complete when every item is in a correctly-labeled bucket.

(function (global) {
  "use strict";

  // ---- EDIT HERE: categories and their member items ----
  const CATEGORIES = [
    { key: "food",     emoji: "🍽️", items: [
      { emoji: "🍎", tag: "apple" }, { emoji: "🍕", tag: "pizza" },
      { emoji: "🧃", tag: "juice" }, { emoji: "🍞", tag: "bread" },
    ]},
    { key: "clothing", emoji: "👕", items: [
      { emoji: "👕", tag: "shirt" }, { emoji: "👖", tag: "jeans" },
      { emoji: "🧦", tag: "socks" }, { emoji: "🧢", tag: "hat" },
    ]},
    { key: "sports",   emoji: "⚽", items: [
      { emoji: "⚽", tag: "ball" }, { emoji: "🏀", tag: "basketball" },
      { emoji: "🎾", tag: "tennis" }, { emoji: "🏒", tag: "puck" },
    ]},
    { key: "toys",     emoji: "🧸", items: [
      { emoji: "🧸", tag: "teddy" }, { emoji: "🚗", tag: "car" },
      { emoji: "🎲", tag: "dice" }, { emoji: "🪁", tag: "kite" },
    ]},
    { key: "tech",     emoji: "💻", items: [
      { emoji: "📱", tag: "phone" }, { emoji: "💻", tag: "laptop" },
      { emoji: "🎧", tag: "headphones" }, { emoji: "⌨️", tag: "keyboard" },
    ]},
  ];

  // Build the flat item list (20 items), each tagged with its category key.
  const ALL_ITEMS = CATEGORIES.reduce((acc, cat) => {
    cat.items.forEach((it) => acc.push({ emoji: it.emoji, tag: it.tag, cat: cat.key }));
    return acc;
  }, []);

  class Level2 {
    constructor(root, opts) {
      this.root = root;
      this.player = opts.player;
      this.onComplete = opts.onComplete || (() => {});
      this.onProgress = opts.onProgress || (() => {});

      this.rack = root.querySelector("#l2-rack");
      this.rackItems = root.querySelector("#l2-rack-items");
      this.bucketsLayer = root.querySelector("#l2-buckets");
      this.trayBtn = root.querySelector("#btn-add-bucket");
      this.hint = root.querySelector("#l2-hint");

      this.items = [];     // { el, cat, inBucket }
      this.buckets = [];   // { el, label, contents:[] }
      this.total = ALL_ITEMS.length;
      this.placed = 0;
      this.done = false;

      this.bindTray();
      this.bindDrag();
      this.reset();
    }

    reset() {
      this.rackItems.innerHTML = "";
      this.bucketsLayer.innerHTML = "";
      this.items = [];
      this.buckets = [];
      this.placed = 0;
      this.done = false;
      this.rack.classList.remove("empty");

      const rng = Seed.layoutRng(this.player.name, this.player.id, 2);

      // Shuffle items (seeded)
      const pool = ALL_ITEMS.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }

      pool.forEach((it) => {
        const el = document.createElement("div");
        el.className = "l2-item";
        el.dataset.draggable = "";
        el.dataset.cat = it.cat;
        el.innerHTML = '<div class="emoji">' + it.emoji + '</div>' +
                       '<div class="tag">' + it.tag + "</div>";
        this.rackItems.appendChild(el);
        const obj = { el, cat: it.cat, inBucket: null };
        this.items.push(obj);
      });

      // flow them into the rack (CSS grid handles placement)
      this.updateProgress();
      this.setHint("Tap “Add bucket 🪣”, tap a bucket to label it with a category, then drag items in.");
    }

    setHint(html) { this.hint.innerHTML = html; }

    // ---- bucket tray ----
    bindTray() {
      // Replace any prior listener so a re-instantiated Level2 doesn't
      // accumulate duplicate click handlers on the shared button.
      this.trayBtn.onclick = () => this.addBucket();
    }

    addBucket() {
      if (this.done) return;
      const el = document.createElement("div");
      el.className = "l2-bucket";
      el.innerHTML =
        '<div class="l2-bucket-emoji">🪣</div>' +
        '<div class="l2-bucket-label">label me</div>' +
        '<div class="l2-bucket-chips"></div>';
      this.bucketsLayer.appendChild(el);

      const bucket = { el, label: "", contents: [] };
      this.buckets.push(bucket);

      el.addEventListener("click", (e) => {
        if (this.done) return;
        // Ignore clicks that land inside an already-open label panel,
        // and clicks on the emoji (which the test harness targets).
        if (e.target.closest(".l2-label-panel")) return;
        if (e.target.closest(".l2-bucket-emoji")) return;
        this.openLabelPanel(bucket);
      });

      this.updateProgress();
    }

    openLabelPanel(bucket) {
      // close any open panel
      this.root.querySelectorAll(".l2-label-panel").forEach((p) => p.remove());

      const panel = document.createElement("div");
      panel.className = "l2-label-panel";
      panel.innerHTML =
        '<div class="l2-label-title">What goes in this bucket?</div>' +
        '<label>Pick a category</label>' +
        '<select class="l2-cat-select">' +
        CATEGORIES.map((c) => '<option value="' + c.key + '">' + c.key + " " + c.emoji + "</option>").join("") +
        "</select>" +
        '<div class="l2-label-preview">This bucket becomes <b class="l2-varname">—</b></div>' +
        '<div class="l2-label-actions">' +
        '<button class="btn primary l2-label-set">Set label</button>' +
        '<button class="btn ghost l2-label-cancel">Cancel</button>' +
        "</div>";
      bucket.el.appendChild(panel);

      const sel = panel.querySelector(".l2-cat-select");
      const prev = panel.querySelector(".l2-varname");
      function refresh() { prev.textContent = sel.value; }
      sel.addEventListener("change", refresh);
      refresh();

      panel.querySelector(".l2-label-set").addEventListener("click", () => {
        const catKey = sel.value;
        bucket.label = catKey;
        const cat = CATEGORIES.find((c) => c.key === catKey);
        const labelEl = bucket.el.querySelector(".l2-bucket-label");
        labelEl.textContent = cat.emoji + " " + catKey;
        bucket.el.classList.add("labeled", "cat-" + catKey);
        // show which items fit
        const chips = bucket.el.querySelector(".l2-bucket-chips");
        chips.innerHTML = cat.items.map((it) => "<span>" + it.emoji + "</span>").join("");
        panel.remove();
        // if any of this bucket's items are stranded, they can now be dropped in
        this.setHint("Bucket <b>" + catKey + "</b> is ready. Drag " + cat.emoji + " items into it.");
      });
      panel.querySelector(".l2-label-cancel").addEventListener("click", () => panel.remove());
    }

    // ---- drag handling (pointer events: mouse + touch) ----
    // The item stays in the DOM; we switch it to position:fixed and track
    // clientX/Y. Hit-testing uses getBoundingClientRect on the buckets.
    bindDrag() {
      const self = this;
      const rack = this.rack;

      function onDown(e) {
        if (self.done) return;
        const target = e.target.closest(".l2-item[data-draggable]");
        if (!target) return;
        e.preventDefault();

        const el = target;
        const obj = self.items.find((o) => o.el === el);
        if (!obj) return;

        // Use transform to drag — the item stays in normal flow, so the
        // rack and buckets don't reflow mid-drag (keeps drop targets stable).
        const startX = e.clientX;
        const startY = e.clientY;
        let dx = 0, dy = 0;

        el.classList.add("dragging");
        el.style.zIndex = "100";

        function onMove(ev) {
          dx = ev.clientX - startX;
          dy = ev.clientY - startY;
          el.style.transform = "translate(" + dx + "px," + dy + "px)";
        }

        function onUp(ev) {
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          document.removeEventListener("pointercancel", onUp);

          // drop point = where the pointer was released
          const cx = ev.clientX;
          const cy = ev.clientY;
          el.style.transform = "";
          el.classList.remove("dragging");
          el.style.zIndex = "";

          // hit-test buckets in client coordinates
          const dropped = self.buckets.find((bk) => {
            if (!bk.label) return false;
            const bb = bk.el.getBoundingClientRect();
            return cx > bb.left && cx < bb.left + bb.width &&
                   cy > bb.top && cy < bb.top + bb.height;
          });

          if (dropped) {
            if (dropped.label === obj.cat) {
              self.putInBucket(obj, dropped);
            } else {
              self.rejectDrop(obj, dropped);
            }
          }
          // if not dropped on any bucket, item stays in its rack slot
        }

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
      }

      rack.addEventListener("pointerdown", onDown);
    }

    putInBucket(obj, bucket) {
      obj.inBucket = bucket;
      obj.el.style.display = "none";
      bucket.contents.push(obj);
      const chip = document.createElement("span");
      chip.className = "l2-chip";
      chip.textContent = obj.el.querySelector(".emoji").textContent;
      bucket.el.querySelector(".l2-bucket-chips").appendChild(chip);
      this.placed++;
      this.updateProgress();
      if (this.placed >= this.total) {
        this.done = true;
        this.setHint("🎉 Every item is sorted! Nice variable names.");
        setTimeout(() => this.onComplete(this.placed), 450);
      }
    }

    rejectDrop(obj, bucket) {
      const cat = CATEGORIES.find((c) => c.key === bucket.label);
      this.setHint("❌ " + obj.el.querySelector(".tag").textContent + " doesn’t belong in <b>" + bucket.label + "</b> (" + cat.emoji + "). It bounced back.");
      this.snapHome(obj);
      // brief shake
      obj.el.classList.add("shake");
      setTimeout(() => obj.el.classList.remove("shake"), 400);
    }

    // (items return to the rack via re-appending; no-op kept for API parity)
    snapHome(obj) {
      obj.el.style.position = "";
      obj.el.style.left = "";
      obj.el.style.top = "";
      obj.el.style.zIndex = "";
      obj.el.style.display = "";
    }

    updateProgress() {
      this.onProgress(this.placed, this.total);
      if (this.placed >= this.total) this.rack.classList.add("empty");
    }
  }

  global.Level2 = Level2;
  global.L2_CATEGORIES = CATEGORIES;
  global.L2_ITEMS = ALL_ITEMS;
})(window);
