import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import UniversityField, {
  UniversityFieldOptions,
} from "../components/courses/university-field";
import {
  commitUniversityValue,
  filterUniversityOptions,
  universitySearchLimit,
} from "../lib/university-field";

test("commitUniversityValue keeps a selected list item over typed text", () => {
  assert.equal(
    commitUniversityValue({ current: "", typed: "دانشگاه", selected: "دانشگاه تهران" }),
    "دانشگاه تهران",
  );
});

test("commitUniversityValue accepts typed text when no list item was selected", () => {
  assert.equal(
    commitUniversityValue({ current: "", typed: "  دانشگاه سوره  ", selected: "" }),
    "دانشگاه سوره",
  );
});

test("commitUniversityValue keeps the current value when nothing was typed or selected", () => {
  assert.equal(
    commitUniversityValue({ current: "دانشگاه تهران", typed: "   ", selected: "" }),
    "دانشگاه تهران",
  );
});

test("filterUniversityOptions trims the query and matches every item containing it", () => {
  const list = [
    "دانشگاه تهران",
    "دانشگاه پیام نور",
    "مرکز آموزش علمی کاربردی تهران",
  ];
  assert.deepEqual(filterUniversityOptions(list, "  تهران  "), [
    "دانشگاه تهران",
    "مرکز آموزش علمی کاربردی تهران",
  ]);
  assert.deepEqual(filterUniversityOptions(list, "پیام"), ["دانشگاه پیام نور"]);
  assert.equal(filterUniversityOptions(list, "  ").length, 3);
});

test("filterUniversityOptions no longer drops universities after the first 80 results", () => {
  const list = Array.from({ length: 300 }, (_, i) => `دانشگاه آزمون ${i}`);
  list[299] = "دانشگاه آزاد اسلامی واحد تهران مرکزی";
  assert.deepEqual(filterUniversityOptions(list, "واحد تهران مرکزی"), [
    "دانشگاه آزاد اسلامی واحد تهران مرکزی",
  ]);
  assert.equal(filterUniversityOptions(list, "آزمون").length, universitySearchLimit);
});

test("university field renders the committed value with search placeholder", () => {
  const markup = renderToStaticMarkup(
    createElement(UniversityField, {
      value: "دانشگاه تهران",
      onChange() {},
      options: ["دانشگاه تهران"],
      inputClassName: "university-input",
      required: true,
    }),
  );
  assert.match(markup, /<input[^>]+data-university-field="university"/);
  assert.match(markup, /value="دانشگاه تهران"/);
  assert.match(markup, /required=""/);
  assert.match(markup, /جستجو و انتخاب دانشگاه/);
  assert.doesNotMatch(markup, /data-university-field="manual-entry"/);
});

test("dropdown shows the explicit manual-entry action when manual mode is off", () => {
  const markup = renderToStaticMarkup(
    createElement(UniversityFieldOptions, {
      matches: ["دانشگاه تهران"],
      manual: false,
      onChoose() {},
      onManualEntry() {},
    }),
  );
  assert.match(markup, /data-university-field="manual-entry"/);
  assert.match(markup, /دانشگاهم در لیست نیست/);
  assert.match(markup, /دانشگاه تهران/);
});

test("dropdown hides the manual-entry action and shows a not-found hint once manual mode is on", () => {
  const markup = renderToStaticMarkup(
    createElement(UniversityFieldOptions, {
      matches: [],
      manual: true,
      onChoose() {},
      onManualEntry() {},
    }),
  );
  assert.doesNotMatch(markup, /data-university-field="manual-entry"/);
  assert.match(markup, /دانشگاهی پیدا نشد/);
});

test("dropdown shows a not-found hint when no university matches", () => {
  const markup = renderToStaticMarkup(
    createElement(UniversityFieldOptions, {
      matches: [],
      manual: false,
      onChoose() {},
      onManualEntry() {},
    }),
  );
  assert.match(markup, /دانشگاهی پیدا نشد/);
});
