import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("committed GPLv3 text is byte-identical to the pinned upstream license", async () => {
  const license = await readFile("data/iran/LICENSE-GPL-3.0.txt");

  assert.equal(
    createHash("sha256").update(license).digest("hex"),
    "38edb472781a55161f804518ac43b91726c36fb65db652158e4955baa08f55ba",
  );
  const text = license.toString("utf8");
  assert.match(
    text,
    /^    List of cities in Iran  Copyright \(C\) 2025  Sajad Dehshiri \(sajaddp\)$/m,
  );
  assert.match(
    text,
    /^The hypothetical commands `show w' and`show c' should show the appropriate$/m,
  );
});
