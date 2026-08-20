"use client";

import React, { useEffect, useState } from "react";
import {
  createLocationRequestOwner,
  parseCityResponse,
  parseProvinceResponse,
  readLocationResponse,
  startLocationLoad,
} from "@/lib/iran-location-client";

interface Province { id: number; name: string; }

export function IranLocationError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return message
    ? <p role="alert" className="-mt-2 flex flex-wrap items-center gap-2 text-xs font-normal text-error md:col-span-2">{message}{onRetry && <button type="button" onClick={onRetry} className="rounded-lg border border-error/40 px-2.5 py-1 font-bold text-error hover:bg-error-container/20">تلاش مجدد</button>}</p>
    : null;
}

export default function IranLocationFields({ province, city, onChange }: { province: string; city: string; onChange: (values: { province: string; city: string }) => void }) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [provinceError, setProvinceError] = useState("");
  const [cityError, setCityError] = useState("");
  const [provinceSearch, setProvinceSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [showProvinces, setShowProvinces] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const [provinceRequestOwner] = useState(createLocationRequestOwner);
  const [cityRequestOwner] = useState(createLocationRequestOwner);
  const [retryKey, setRetryKey] = useState(0);
  const provinceId = provinces.find((item) => item.name === province)?.id;

  useEffect(() => {
    const load = startLocationLoad({
      owner: provinceRequestOwner,
      errorMessage: "دریافت فهرست استان‌ها ناموفق بود",
      load: (signal) => readLocationResponse(
        fetch("/api/locations", { signal }),
        parseProvinceResponse,
        signal,
      ),
      onStart: () => setProvinceError(""),
      onSuccess: (nextProvinces) => {
        setProvinces(nextProvinces);
        setProvinceError("");
      },
      onError: (message) => {
        setProvinces([]);
        setProvinceError(message);
      },
      onComplete: () => {},
    });
    return load.cancel;
  }, [provinceRequestOwner, retryKey]);
  useEffect(() => {
    setCities([]);
    setCitySearch("");
    setShowCities(false);
    if (!provinceId) {
      cityRequestOwner.cancel();
      setLoadingCities(false);
      setCityError("");
      return;
    }
    const load = startLocationLoad({
      owner: cityRequestOwner,
      errorMessage: "دریافت فهرست شهرها ناموفق بود",
      load: (signal) => readLocationResponse(
        fetch(`/api/locations?provinceId=${provinceId}`, { signal }),
        parseCityResponse,
        signal,
      ),
      onStart: () => {
        setCityError("");
        setLoadingCities(true);
      },
      onSuccess: (nextCities) => {
        setCities(nextCities);
        setCityError("");
      },
      onError: (message) => {
        setCities([]);
        onChange({ province, city: "" });
        setCityError(message);
      },
      onComplete: () => setLoadingCities(false),
    });
    return load.cancel;
  }, [provinceId, cityRequestOwner, retryKey]);

  const inputClass = "mt-1.5 w-full rounded-xl border border-surface-variant bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary-fixed disabled:cursor-not-allowed disabled:bg-surface-low";
  const filteredProvinces = provinces.filter((item) => item.name.includes(provinceSearch));
  const filteredCities = cities.filter((name) => name.includes(citySearch));
  const locationError = provinceError || cityError;
  return <><label className="relative text-sm font-bold text-primary">استان *<input value={showProvinces ? provinceSearch : province} onFocus={() => { setProvinceSearch(""); setShowProvinces(true); }} onChange={(event) => { setProvinceSearch(event.target.value); setShowProvinces(true); }} placeholder="جستجو و انتخاب استان" className={inputClass} />{showProvinces && <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-surface-variant bg-white p-1 shadow-lg">{filteredProvinces.map((item) => <button type="button" key={item.id} onClick={() => { onChange({ province: item.name, city: "" }); setShowProvinces(false); }} className="block w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-surface-low">{item.name}</button>)}{filteredProvinces.length === 0 && <p className="p-3 text-center text-xs text-outline">استانی پیدا نشد</p>}</div>}</label><label className="relative text-sm font-bold text-primary">شهر *<input value={showCities ? citySearch : city} disabled={!provinceId || loadingCities} onFocus={() => { setCitySearch(""); setShowCities(true); }} onChange={(event) => { setCitySearch(event.target.value); setShowCities(true); }} placeholder={loadingCities ? "در حال دریافت شهرها..." : provinceId ? "جستجو و انتخاب شهر" : "ابتدا استان را انتخاب کنید"} className={inputClass} />{showCities && <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-surface-variant bg-white p-1 shadow-lg">{filteredCities.map((name) => <button type="button" key={name} onClick={() => { onChange({ province, city: name }); setShowCities(false); }} className="block w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-surface-low">{name}</button>)}{filteredCities.length === 0 && <p className="p-3 text-center text-xs text-outline">شهری پیدا نشد</p>}</div>}</label><IranLocationError message={locationError} onRetry={() => setRetryKey((current) => current + 1)} /></>;
}
