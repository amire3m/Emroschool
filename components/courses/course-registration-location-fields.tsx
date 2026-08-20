import React from "react";

import IranLocationFields, { IranLocationError } from "@/components/ui/iran-location-fields";
import {
  TehranNeighborhoodInput,
  type TehranLocationValue,
  updateTehranLocation,
} from "@/components/ui/tehran-location-input";
import {
  districtNames,
  startLocationLoad,
  type LocationRequestOwner,
} from "@/lib/iran-location-client";

export function startCourseTehranDistrictLoad({
  owner,
  load,
  onDistrictsChange,
  onErrorChange,
}: {
  owner: LocationRequestOwner;
  load: (signal: AbortSignal) => Promise<Record<string, string[]>>;
  onDistrictsChange: (districts: Record<string, string[]>) => void;
  onErrorChange: (error: string) => void;
}) {
  return startLocationLoad({
    owner,
    errorMessage: "دریافت فهرست مناطق تهران ناموفق بود",
    load,
    onStart: () => {
      onDistrictsChange({});
      onErrorChange("");
    },
    onSuccess: (districts) => {
      onDistrictsChange(districts);
      onErrorChange("");
    },
    onError: (message) => {
      onDistrictsChange({});
      onErrorChange(message);
    },
    onComplete: () => {},
  });
}

export default function CourseRegistrationLocationFields({
  districts,
  value,
  onChange,
  inputClassName,
  districtError = "",
}: {
  districts: Record<string, string[]>;
  value: TehranLocationValue;
  onChange: (value: TehranLocationValue) => void;
  inputClassName: string;
  districtError?: string;
}) {
  const isTehran = value.province === "تهران" && value.city === "تهران";
  return (
    <>
      <IranLocationFields
        province={value.province}
        city={value.city}
        onChange={({ province, city }) =>
          onChange(updateTehranLocation(value, { province, city }))
        }
      />
      <IranLocationError message={districtError} />
      {isTehran && (
        <>
          <label className="text-sm font-bold text-primary">
            منطقه محل سکونت *
            <select
              data-location-field="district"
              value={value.district}
              onChange={(event) =>
                onChange(updateTehranLocation(value, { district: event.target.value }))
              }
              className={inputClassName}
            >
              <option value="">انتخاب منطقه</option>
              {districtNames(districts).map((district) => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-bold text-primary">
            محله محل سکونت
            <TehranNeighborhoodInput
              value={value.neighborhood}
              disabled={!value.district}
              onChange={(neighborhood) =>
                onChange(updateTehranLocation(value, { neighborhood }))
              }
              className={`${inputClassName} disabled:cursor-not-allowed disabled:bg-surface-low`}
            />
          </label>
        </>
      )}
    </>
  );
}
