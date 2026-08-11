import assert from "node:assert/strict";
import test from "node:test";
import {
  Children,
  createElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";

import CourseRegistrationLocationFields, {
  startCourseTehranDistrictLoad,
} from "../components/courses/course-registration-location-fields";
import StandaloneRegistrationLocationFields from "../components/auth/standalone-registration-location-fields";
import { IranLocationError } from "../components/ui/iran-location-fields";
import { createLocationRequestOwner } from "../lib/iran-location-client";

const districts = {
  "منطقه ۱ شهر تهران": [],
  "منطقه ۲ شهر تهران": [],
};
const location = {
  province: "تهران",
  city: "تهران",
  district: "منطقه ۲ شهر تهران",
  neighborhood: "محله واردشده توسط کاربر",
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return { promise, resolve, reject };
}

function findField(node: ReactNode, field: string): ReactElement {
  if (isValidElement(node) && node.props["data-location-field"] === field) return node;
  if (
    isValidElement(node) &&
    typeof node.type === "function" &&
    node.type.name === "LocationSelect"
  ) {
    const render = node.type as (props: Record<string, unknown>) => ReactNode;
    return findField(render(node.props as Record<string, unknown>), field);
  }
  if (isValidElement(node)) {
    const props = node.props as { children?: ReactNode };
    for (const child of Children.toArray(props.children)) {
      try {
        return findField(child, field);
      } catch {}
    }
  }
  throw new Error(`Location field not found: ${field}`);
}

function assertTehranMarkup(markup: string) {
  assert.match(markup, /<option value="منطقه ۱ شهر تهران">/);
  assert.match(markup, /<option value="منطقه ۲ شهر تهران" selected="">/);
  assert.match(markup, /<input[^>]+data-location-field="neighborhood"/);
  assert.match(markup, /required=""/);
  assert.match(markup, /value="محله واردشده توسط کاربر"/);
  assert.doesNotMatch(markup, /data-location-field="neighborhood"[^>]*><option/);
}

test("Iran location consumer distinguishes a localized load failure from empty results", () => {
  assert.equal(renderToStaticMarkup(createElement(IranLocationError, { message: "" })), "");
  const markup = renderToStaticMarkup(createElement(IranLocationError, {
    message: "دریافت فهرست شهرها ناموفق بود",
  }));
  assert.match(markup, /role="alert"/);
  assert.match(markup, /دریافت فهرست شهرها ناموفق بود/);
});

test("standalone consumer renders object districts and drives province-dependent clearing", () => {
  let changed = location;
  const props = {
    provinces: [
      { id: 123, name: "تهران" },
      { id: 130, name: "البرز" },
    ],
    cities: ["تهران"],
    districts,
    value: location,
    onChange(next: typeof location) {
      changed = next;
    },
  };

  assertTehranMarkup(
    renderToStaticMarkup(createElement(StandaloneRegistrationLocationFields, props)),
  );

  const tree = StandaloneRegistrationLocationFields(props);
  findField(tree, "province").props.onChange({ target: { value: "البرز" } });
  assert.deepEqual(changed, {
    province: "البرز",
    city: "",
    district: "",
    neighborhood: "",
  });
});

test("standalone consumer hides Tehran fields and clears them when Tehran province selects Rey", () => {
  let changed = location;
  const props = {
    provinces: [{ id: 123, name: "تهران" }],
    cities: ["تهران", "ری"],
    districts,
    value: location,
    onChange(next: typeof location) {
      changed = next;
    },
  };

  const tree = StandaloneRegistrationLocationFields(props);
  findField(tree, "city").props.onChange({ target: { value: "ری" } });
  assert.deepEqual(changed, {
    province: "تهران",
    city: "ری",
    district: "",
    neighborhood: "",
  });

  const reyMarkup = renderToStaticMarkup(createElement(
    StandaloneRegistrationLocationFields,
    { ...props, value: changed },
  ));
  assert.doesNotMatch(reyMarkup, /data-location-field="district"/);
  assert.doesNotMatch(reyMarkup, /data-location-field="neighborhood"/);
});

test("course modal consumer renders object districts and drives district-dependent clearing", () => {
  let changed = location;
  const props = {
    districts,
    value: location,
    onChange(next: typeof location) {
      changed = next;
    },
    inputClassName: "course-location-input",
  };

  assertTehranMarkup(
    renderToStaticMarkup(createElement(CourseRegistrationLocationFields, props)),
  );

  const tree = CourseRegistrationLocationFields(props);
  findField(tree, "district").props.onChange({
    target: { value: "منطقه ۱ شهر تهران" },
  });
  assert.deepEqual(changed, {
    province: "تهران",
    city: "تهران",
    district: "منطقه ۱ شهر تهران",
    neighborhood: "",
  });
});

test("course location consumer renders its localized Tehran district load error", () => {
  const markup = renderToStaticMarkup(createElement(CourseRegistrationLocationFields, {
    districts: {},
    districtError: "دریافت فهرست مناطق تهران ناموفق بود",
    value: location,
    onChange() {},
    inputClassName: "course-location-input",
  }));

  assert.match(markup, /role="alert"/);
  assert.match(markup, /دریافت فهرست مناطق تهران ناموفق بود/);
  assert.match(markup, /text-xs/);
});

test("course Tehran district loader exposes only current errors and clears them on retry and success", async () => {
  const owner = createLocationRequestOwner();
  const state: { districts: Record<string, string[]>; error: string } = {
    districts,
    error: "خطای قبلی",
  };
  const apply = {
    owner,
    onDistrictsChange(nextDistricts: Record<string, string[]>) {
      state.districts = nextDistricts;
    },
    onErrorChange(error: string) {
      state.error = error;
    },
  };

  const staleFailure = deferred<Record<string, string[]>>();
  const currentSuccess = deferred<Record<string, string[]>>();
  const first = startCourseTehranDistrictLoad({
    ...apply,
    load: () => staleFailure.promise,
  });
  const second = startCourseTehranDistrictLoad({
    ...apply,
    load: () => currentSuccess.promise,
  });
  staleFailure.reject(new Error("stale"));
  await first.done;
  assert.deepEqual(state, { districts: {}, error: "" });
  currentSuccess.resolve(districts);
  await second.done;
  assert.deepEqual(state, { districts, error: "" });

  const currentFailure = startCourseTehranDistrictLoad({
    ...apply,
    load: () => Promise.reject(new Error("current")),
  });
  await currentFailure.done;
  assert.deepEqual(state, {
    districts: {},
    error: "دریافت فهرست مناطق تهران ناموفق بود",
  });

  const retry = deferred<Record<string, string[]>>();
  const retryLoad = startCourseTehranDistrictLoad({
    ...apply,
    load: () => retry.promise,
  });
  assert.deepEqual(state, { districts: {}, error: "" });
  retry.resolve(districts);
  await retryLoad.done;
  assert.deepEqual(state, { districts, error: "" });
});
