import Database from 'better-sqlite3';

// better-sqlite3 >= 13 picks its bundled prebuild from `process.platform` on the first
// connection and caches it. Several suites stub `process.platform`, so open a connection while
// the real platform is still in place.
new Database(':memory:').close();
