"use strict";

// Content-pack archive limits: zip bombs, duplicates and unsafe paths are
// refused before extraction. Uses adm-zip to build real archives in temp.
// Run from anywhere: node tests/content-pack-limits-fixtures.js

const fs = require("fs");
const os = require("os");
const path = require("path");

const root = path.join(__dirname, "..");
const AdmZip = require(path.join(root, "node_modules", "adm-zip"));
const { assertArchiveWithinLimits, PACK_LIMITS } = require(path.join(root, "src", "contentInstaller.js"));

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function throws(fn, pattern, message) {
  try {
    fn();
  } catch (error) {
    assert(pattern.test(error.message), `${message} (got: ${error.message})`);
    return;
  }
  throw new Error(`${message} (did not throw)`);
}

const fake = (entryName, size, compressedSize) => ({ entryName, header: { size, compressedSize } });

// Normal archive passes.
assertArchiveWithinLimits([fake("manifest.json", 2000, 800), fake("data/npcs.json", 50000, 9000)], 10000);

throws(() => assertArchiveWithinLimits([fake("../evil.json", 10, 10)], 100), /Unsafe content-pack path/, "zip-slip entry refused");
throws(() => assertArchiveWithinLimits([fake("C:/evil.json", 10, 10)], 100), /Unsafe content-pack path/, "drive-letter entry refused");
throws(() => assertArchiveWithinLimits([fake("a.json", 10, 10), fake("A.json", 10, 10)], 100), /duplicate entry/, "duplicate entry (case-insensitive) refused");
throws(() => assertArchiveWithinLimits([fake("bomb.json", 100 * 1024 * 1024, 1024)], 2048), /compressed suspiciously well/, "high compression ratio refused");
throws(() => assertArchiveWithinLimits([fake("big.bin", PACK_LIMITS.maxEntryBytes + 1, PACK_LIMITS.maxEntryBytes)], 1000), /too large/, "oversized entry refused");
throws(() => assertArchiveWithinLimits([], PACK_LIMITS.maxArchiveBytes + 1), /250 MB/, "oversized archive refused");
throws(
  () => assertArchiveWithinLimits(Array.from({ length: PACK_LIMITS.maxEntries + 1 }, (_, i) => fake(`f${i}.json`, 1, 1)), 100),
  /more than/,
  "too many entries refused"
);
throws(
  () => assertArchiveWithinLimits(Array.from({ length: 5 }, (_, i) => fake(`f${i}.bin`, 190 * 1024 * 1024, 100 * 1024 * 1024)), 1000),
  /750 MB/,
  "total expansion limit enforced"
);

// Real adm-zip archive: header sizes are what the guard reads.
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "mf-zip-"));
try {
  const zip = new AdmZip();
  zip.addFile("manifest.json", Buffer.from(JSON.stringify({ format: "masterforge-content-pack" })));
  zip.addFile("data/bomb.json", Buffer.alloc(20 * 1024 * 1024, 0x20));
  const file = path.join(temp, "pack.mforge");
  zip.writeZip(file);
  const entries = new AdmZip(file).getEntries();
  assert(entries.every(entry => Number.isFinite(entry.header.size)), "adm-zip exposes uncompressed sizes");
  throws(() => assertArchiveWithinLimits(entries, fs.statSync(file).size), /compressed suspiciously well/, "real highly-compressed archive refused");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}

console.log("Content-pack limit fixtures passed.");
