// Seeded PRNG + deterministic password derivation (no backend, no storage).
// Two students with the same name+ID always get the same password.
// Different name+ID pairs get (effectively) different passwords.

(function (global) {
  "use strict";

  // FNV-1a 32-bit hash of a string -> uint32
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return h >>> 0;
  }

  // mulberry32 — small, fast, well-distributed PRNG from a 32-bit seed
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Normalise a player identity so "Sam 7", "sam 7", "Sam 07" all match.
  // ID is parsed as an integer so leading zeros don't change the identity.
  function normalizeIdentity(name, id) {
    const cleanName = String(name || "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "");
    const n = parseInt(String(id || "").replace(/[^0-9]/g, ""), 10);
    const cleanId = Number.isFinite(n) ? String(n) : "";
    return cleanName + "#" + cleanId;
  }

  const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1 to avoid confusion

  // Derive a 6-char password from name+id.
  function derivePassword(name, id, length) {
    const len = length || 6;
    const seed = fnv1a(normalizeIdentity(name, id) + "::password");
    const rnd = mulberry32(seed);
    let out = "";
    for (let i = 0; i < len; i++) {
      out += ALPHABET[Math.floor(rnd() * ALPHABET.length)];
    }
    return out;
  }

  // Derive a *different* per-level password (level 2 uses a different salt).
  function deriveLevelPassword(name, id, level) {
    return derivePassword(name + "::lvl" + level, 6);
  }

  // A short code students submit to Google Classroom (distinct salt from
  // the level password, so it isn't the same 6 chars).
  function deriveClassroomCode(name, id) {
    return derivePassword(name + "::classroom", 6);
  }

  // Seeded RNG for layout: same name+id => same room layout every reset
  // (within the same level). Different players get different layouts.
  function layoutRng(name, id, level) {
    const seed = fnv1a(normalizeIdentity(name, id) + "::layout::level" + (level || 1));
    return mulberry32(seed);
  }

  global.Seed = {
    fnv1a,
    mulberry32,
    normalizeIdentity,
    derivePassword,
    deriveLevelPassword,
    deriveClassroomCode,
    layoutRng,
    ALPHABET,
  };
})(window);
