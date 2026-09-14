// Level 1 — "The Bucket Room"
// Random room, draggable items, a bucket that must be seated in the bottom-left,
// then all other items dragged into the bucket.

(function (global) {
  "use strict";

  const ITEMS = [
    { emoji: "📚", tag: "books" },
    { emoji: "🧦", tag: "socks" },
    { emoji: "👟", tag: "shoes" },
    { emoji: "🧸", tag: "teddy" },
    { emoji: "🎒", tag: "backpack" },
    { emoji: "🍎", tag: "apple" },
    { emoji: "⚽", tag: "ball" },
    { emoji: "🧃", tag: "juice" },
    { emoji: "📎", tag: "clips" },
    { emoji: "🔑", tag: "keys" },
    { emoji: "🕶️", tag: "glasses" },
    { emoji: "🧴", tag: "lotion" },
  ];

  class Level1 {
    constructor(root, opts) {
      this.root = root;
      this.player = opts.player; // { name, id }
      this.onComplete = opts.onComplete; // called with count
      this.onProgress = opts.onProgress || (() => {});

      this.room = root.querySelector("#room");
      this.itemsLayer = root.querySelector("#items-layer");
      this.bucket = root.querySelector("#bucket");
      this.slot = root.querySelector("#bucket-slot");
      this.bucketContents = root.querySelector("#bucket-contents");

      this.items = [];        // { el, x, y, w, h, inBucket }
      this.bucketSeated = false;
      this.inBucketCount = 0;
      this.total = 0;
      this.done = false;

      this.bindDrag();
      this.reset();
    }

    // Build (or rebuild) the room using a seeded layout for this player.
    reset() {
      this.itemsLayer.innerHTML = "";
      this.bucketContents.innerHTML = "";
      this.items = [];
      this.inBucketCount = 0;
      this.done = false;
      this.bucketSeated = false;
      this.slot.classList.remove("filled");

      const rng = Seed.layoutRng(this.player.name, this.player.id, 1);
      const roomRect = this.room.getBoundingClientRect();
      const W = roomRect.width;
      const H = roomRect.height;

      // Shuffle items with the seeded rng (Fisher-Yates)
      const pool = ITEMS.slice();
      for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
      }
      // Pick 8 items for this round (fewer on small screens)
      const count = W < 480 ? 6 : 8;
      const chosen = pool.slice(0, count);
      this.total = chosen.length;

      // Slot occupies bottom-left; keep items out of it.
      const slotRect = this.slot.getBoundingClientRect();
      const slotInRoom = {
        x: slotRect.left - roomRect.left,
        y: slotRect.top - roomRect.top,
        w: slotRect.width,
        h: slotRect.height,
      };

      chosen.forEach((it) => {
        const el = document.createElement("div");
        el.className = "item";
        el.dataset.draggable = "";
        el.innerHTML =
          '<div class="emoji">' + it.emoji + "</div>" +
          '<div class="tag">' + it.tag + "</div>";
        this.itemsLayer.appendChild(el);
        const obj = { el, item: it, inBucket: false };
        this.placeItem(obj, rng, W, H, slotInRoom);
        this.items.push(obj);
      });

      // Place the bucket at a random spot (not on the slot)
      this.placeBucket(rng, W, H, slotInRoom);

      this.updateProgress();
    }

    // Place a single item at a non-overlapping spot, away from the slot.
    placeItem(obj, rng, W, H, slotInRoom) {
      const el = obj.el;
      el.style.width = "";
      el.style.left = "0px";
      el.style.top = "0px";
      // force layout to measure
      const w = el.offsetWidth || 70;
      const h = el.offsetHeight || 70;

      const pad = 8;
      const maxX = Math.max(pad, W - w - pad);
      const maxY = Math.max(pad, H - h - pad);

      let x = 0, y = 0, tries = 0, ok = false;
      while (!ok && tries < 80) {
        tries++;
        x = pad + rng() * (maxX - pad);
        y = pad + rng() * (maxY - pad);
        // avoid the drop slot area
        const inSlot =
          x + w > slotInRoom.x - 6 &&
          x < slotInRoom.x + slotInRoom.w + 6 &&
          y + h > slotInRoom.y - 6 &&
          y < slotInRoom.y + slotInRoom.h + 6;
        if (inSlot) continue;
        // avoid overlapping other placed items (with small margin)
        const overlaps = this.items.some((o) => {
          if (o.inBucket) return false;
          const ox = parseFloat(o.el.style.left) || 0;
          const oy = parseFloat(o.el.style.top) || 0;
          const ow = o.el.offsetWidth || 70;
          const oh = o.el.offsetHeight || 70;
          return !(x + w + 6 < ox || ox + ow + 6 < x || y + h + 6 < oy || oy + oh + 6 < y);
        });
        if (!overlaps) ok = true;
      }
      obj.x = x;
      obj.y = y;
      obj.homeX = x;
      obj.homeY = y;
      el.style.left = x + "px";
      el.style.top = y + "px";
    }

    placeBucket(rng, W, H, slotInRoom) {
      const pad = 10;
      const bw = this.bucket.offsetWidth || 90;
      const bh = this.bucket.offsetHeight || 90;
      let x = 0, y = 0, tries = 0, ok = false;
      while (!ok && tries < 60) {
        tries++;
        x = pad + rng() * Math.max(pad, W - bw - pad);
        y = pad + rng() * Math.max(pad, H - bh - pad);
        const inSlot =
          x + bw > slotInRoom.x - 4 &&
          x < slotInRoom.x + slotInRoom.w + 4 &&
          y + bh > slotInRoom.y - 4 &&
          y < slotInRoom.y + slotInRoom.h + 4;
        if (!inSlot) ok = true;
      }
      this.bucket.style.left = x + "px";
      this.bucket.style.top = y + "px";
      this.bucket.classList.remove("seated");
    }

    // ---- drag handling (pointer events: mouse + touch unified) ----
    bindDrag() {
      const self = this;
      const room = this.room;

      function onDown(e) {
        if (self.done) return;
        const target = e.target.closest("[data-draggable]");
        if (!target) return;
        e.preventDefault();

        const isBucket = target === self.bucket;
        const el = target;
        const rect = el.getBoundingClientRect();
        const roomRect = room.getBoundingClientRect();
        const grabDX = e.clientX - rect.left;
        const grabDY = e.clientY - rect.top;

        el.classList.add("dragging");

        function onMove(ev) {
          const nx = ev.clientX - roomRect.left - grabDX;
          const ny = ev.clientY - roomRect.top - grabDY;
          const w = el.offsetWidth;
          const h = el.offsetHeight;
          const cx = Math.max(0, Math.min(roomRect.width - w, nx));
          const cy = Math.max(0, Math.min(roomRect.height - h, ny));
          el.style.left = cx + "px";
          el.style.top = cy + "px";
        }

        function onUp(ev) {
          el.classList.remove("dragging");
          document.removeEventListener("pointermove", onMove);
          document.removeEventListener("pointerup", onUp);
          document.removeEventListener("pointercancel", onUp);

          const cx = parseFloat(el.style.left) || 0;
          const cy = parseFloat(el.style.top) || 0;
          const w = el.offsetWidth;
          const h = el.offsetHeight;

          if (isBucket) {
            // Lifting a seated bucket out of the corner lets you reposition it.
            if (self.bucketSeated) {
              self.unseatBucket();
            }
            self.trySeatBucket(cx, cy, w, h);
          } else {
            // Only accept items into the bucket once it's seated
            if (self.bucketSeated) {
              const bc = self.bucket.getBoundingClientRect();
              const br = room.getBoundingClientRect();
              const bx = bc.left - br.left;
              const by = bc.top - br.top;
              const bw = bc.width;
              const bh = bc.height;
              // accept if a good chunk of the item overlaps the bucket mouth
              const ox = Math.min(cx + w, bx + bw) - Math.max(cx, bx);
              const oy = Math.min(cy + h, by + bh) - Math.max(cy, by);
              if (ox > w * 0.3 && oy > h * 0.3) {
                self.putInBucket(el);
              } else {
                // Missed the bucket — snap back home so it can't get
                // trapped behind the corner slot.
                self.snapHome(el);
              }
            }
          }
        }

        document.addEventListener("pointermove", onMove);
        document.addEventListener("pointerup", onUp);
        document.addEventListener("pointercancel", onUp);
      }

      this.room.addEventListener("pointerdown", onDown);
    }

    trySeatBucket(x, y, w, h) {
      const s = this.slot.getBoundingClientRect();
      const r = this.room.getBoundingClientRect();
      const sx = s.left - r.left, sy = s.top - r.top;
      const overlapX = x + w > sx && x < sx + s.width;
      const overlapY = y + h > sy && y < sy + s.height;
      if (overlapX && overlapY) {
        // snap to slot
        this.bucket.style.left = sx + "px";
        this.bucket.style.top = sy + "px";
        this.bucketSeated = true;
        this.bucket.classList.add("seated");
        this.slot.classList.add("filled");
      }
    }

    unseatBucket() {
      this.bucketSeated = false;
      this.bucket.classList.remove("seated");
      this.slot.classList.remove("filled");
    }

    snapHome(el) {
      const obj = this.items.find((o) => o.el === el);
      if (!obj || obj.inBucket) return;
      el.style.left = obj.homeX + "px";
      el.style.top = obj.homeY + "px";
    }

    putInBucket(el) {
      const obj = this.items.find((o) => o.el === el);
      if (!obj || obj.inBucket) return;
      obj.inBucket = true;
      el.style.display = "none";
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = obj.item.emoji;
      this.bucketContents.appendChild(chip);
      this.inBucketCount++;
      this.updateProgress();
      if (this.inBucketCount >= this.total) {
        this.done = true;
        setTimeout(() => this.onComplete && this.onComplete(this.inBucketCount), 350);
      }
    }

    updateProgress() {
      this.onProgress(this.inBucketCount, this.total);
    }

    // Resize support: re-seat the bucket if it was seated.
    handleResize() {
      if (this.done) return;
      if (this.bucketSeated) {
        const s = this.slot.getBoundingClientRect();
        const r = this.room.getBoundingClientRect();
        this.bucket.style.left = (s.left - r.left) + "px";
        this.bucket.style.top = (s.top - r.top) + "px";
      }
    }
  }

  global.Level1 = Level1;
})(window);
