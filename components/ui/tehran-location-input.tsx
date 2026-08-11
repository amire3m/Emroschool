import React, { type ChangeEvent } from "react";

export interface TehranLocationValue {
  province: string;
  city: string;
  district: string;
  neighborhood: string;
}

export function districtNames(districts: Record<string, string[]>): string[] {
  return Object.keys(districts);
}

export function updateTehranLocation<T extends TehranLocationValue>(
  current: T,
  change: Partial<TehranLocationValue>,
): T {
  const next = { ...current, ...change };
  if (change.province !== undefined && change.province !== current.province) {
    return { ...next, city: "", district: "", neighborhood: "" };
  }
  if (change.city !== undefined && change.city !== current.city) {
    return { ...next, district: "", neighborhood: "" };
  }
  if (change.district !== undefined && change.district !== current.district) {
    return { ...next, neighborhood: "" };
  }
  return next;
}

export function TehranNeighborhoodInput({
  value,
  onChange,
  className,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <input
      type="text"
      data-location-field="neighborhood"
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      className={className}
      disabled={disabled}
      required
      placeholder={disabled ? "ابتدا منطقه را انتخاب کنید" : "نام محله را وارد کنید"}
    />
  );
}
