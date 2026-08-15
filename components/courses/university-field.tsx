import React, { useState } from "react";
import {
  commitUniversityValue,
  filterUniversityOptions,
} from "@/lib/university-field";

export function UniversityFieldOptions({
  matches,
  manual,
  onChoose,
  onManualEntry,
}: {
  matches: string[];
  manual: boolean;
  onChoose: (name: string) => void;
  onManualEntry: () => void;
}) {
  return (
    <div className="absolute z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-xl border border-surface-variant bg-white p-1 shadow-lg">
      {matches.length === 0 && (
        <p className="p-3 text-center text-xs text-outline">دانشگاهی پیدا نشد</p>
      )}
      {matches.map((name) => (
        <button
          type="button"
          key={name}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChoose(name)}
          className="block w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-surface-low"
        >
          {name}
        </button>
      ))}
      {!manual && (
        <button
          type="button"
          data-university-field="manual-entry"
          onMouseDown={(event) => event.preventDefault()}
          onClick={onManualEntry}
          className="mt-1 block w-full rounded-lg border-t border-surface-variant px-3 py-2 text-right text-xs font-bold text-secondary hover:bg-surface-low"
        >
          دانشگاهم در لیست نیست؛ دستی وارد میکنم
        </button>
      )}
    </div>
  );
}

export default function UniversityField({
  value,
  onChange,
  options,
  inputClassName = "",
  required = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  inputClassName?: string;
  required?: boolean;
}) {
  const [search, setSearch] = useState(value);
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState(false);
  const matches = filterUniversityOptions(options, search);

  function commitWith(typed: string, selected = "") {
    onChange(commitUniversityValue({ current: value, typed, selected }));
    setOpen(false);
  }

  function choose(name: string) {
    onChange(name);
    setOpen(false);
  }

  function activateManual() {
    commitWith(search);
    setManual(true);
  }

  return (
    <span className="relative block">
      <input
        type="text"
        data-university-field="university"
        value={open ? search : value}
        onFocus={() => {
          setSearch(value);
          setOpen(true);
        }}
        onChange={(event) => {
          setSearch(event.target.value);
          setOpen(true);
          setManual(false);
        }}
        onBlur={() => commitWith(search)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commitWith(search);
          }
        }}
        placeholder="جستجو و انتخاب دانشگاه"
        className={inputClassName}
        required={required}
      />
      {open && (
        <UniversityFieldOptions
          matches={matches}
          manual={manual}
          onChoose={choose}
          onManualEntry={activateManual}
        />
      )}
      {manual && (
        <p className="mt-1 text-[11px] font-normal text-secondary">
          نام دانشگاه بهصورت دستی ثبت شد.
        </p>
      )}
    </span>
  );
}
