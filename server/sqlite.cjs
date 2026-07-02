/**
 * SQLite adapter — one API, two engines.
 * Prefers better-sqlite3 (fast, battle-tested) when its native build exists;
 * falls back to Node's built-in node:sqlite (v22.5+) otherwise.
 * Exposed surface: prepare().run/get/all, exec(), transaction(fn).
 */
function open(dbPath) {
  const db = openRaw(dbPath);
  // Both engines reject `undefined` binds; normalize to null centrally.
  const rawPrepare = db.prepare.bind(db);
  db.prepare = (sql) => {
    const stmt = rawPrepare(sql);
    const clean = (args) => args.map(a => a === undefined ? null : a);
    return {
      run: (...a) => stmt.run(...clean(a)),
      get: (...a) => stmt.get(...clean(a)),
      all: (...a) => stmt.all(...clean(a)),
    };
  };
  return db;
}

function openRaw(dbPath) {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
    db.__engine = "better-sqlite3";
    return db;
  } catch {
    const { DatabaseSync } = require("node:sqlite");
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    // shim better-sqlite3's transaction()
    db.transaction = (fn) => (...args) => {
      db.exec("BEGIN");
      try { const out = fn(...args); db.exec("COMMIT"); return out; }
      catch (e) { db.exec("ROLLBACK"); throw e; }
    };
    db.__engine = "node:sqlite";
    return db;
  }
}
module.exports = { open };
