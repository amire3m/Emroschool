import React from "react";

import {
  TehranNeighborhoodInput,
  type TehranLocationValue,
  updateTehranLocation,
} from "@/components/ui/tehran-location-input";
import { districtNames } from "@/lib/iran-location-client";

interface Province {
  id: number;
  name: string;
}

function LocationSelect({
  field,
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  field: string;
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <label className="block text-sm font-bold text-primary">
      <span className="mb-2 block">{label}</span>
      <select
        data-location-field={field}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        className="w-full rounded-xl border border-outline-variant bg-white px-4 py-3.5 text-sm disabled:opacity-50"
      >
        <option value="">انتخاب کنید</option>
        {options.map((option) => (
          <option key={option} value={option}>{option}</option>
        ))}
      </select>
    </label>
  );
}

export default function StandaloneRegistrationLocationFields({
  provinces,
  cities,
  districts,
  value,
  onChange,
}: {
  provinces: Province[];
  cities: string[];
  districts: Record<string, string[]>;
  value: TehranLocationValue;
  onChange: (value: TehranLocationValue) => void;
}) {
  return (
    <>
      <LocationSelect
        field="province"
        label="استان"
        value={value.province}
        onChange={(province) => onChange(updateTehranLocation(value, { province }))}
        options={provinces.map((province) => province.name)}
      />
      <LocationSelect
        field="city"
        label="شهر"
        value={value.city}
        onChange={(city) => onChange(updateTehranLocation(value, { city }))}
        options={cities}
        disabled={!value.province}
      />
      {value.province === "تهران" && value.city === "تهران" && (
        <>
          <LocationSelect
            field="district"
            label="منطقه"
            value={value.district}
            onChange={(district) => onChange(updateTehranLocation(value, { district }))}
            options={districtNames(districts)}
          />
          <label className="block text-sm font-bold text-primary [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:border-outline-variant [&_input]:bg-white [&_input]:px-4 [&_input]:py-3.5 [&_input]:text-sm [&_input]:font-normal [&_input]:outline-none [&_input]:focus:ring-2 [&_input]:focus:ring-secondary">
            <span className="mb-2 block">محله</span>
            <TehranNeighborhoodInput
              value={value.neighborhood}
              onChange={(neighborhood) =>
                onChange(updateTehranLocation(value, { neighborhood }))
              }
              disabled={!value.district}
            />
          </label>
        </>
      )}
    </>
  );
}
