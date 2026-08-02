"use client";

import { useEffect, useState } from "react";

interface Province { id: number; name: string; }

export default function IranLocationFields({ province, city, onChange }: { province: string; city: string; onChange: (values: { province: string; city: string }) => void }) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const [provinceSearch, setProvinceSearch] = useState("");
  const [citySearch, setCitySearch] = useState("");
  const [showProvinces, setShowProvinces] = useState(false);
  const [showCities, setShowCities] = useState(false);
  const provinceId = provinces.find((item) => item.name === province)?.id;

  useEffect(() => { fetch("/api/locations").then((response) => response.json()).then((data) => setProvinces(data.provinces || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!provinceId) { setCities([]); return; }
    setLoadingCities(true);
    fetch(`/api/locations?provinceId=${provinceId}`).then((response) => response.json()).then((data) => setCities(data.cities || [])).catch(() => setCities([])).finally(() => setLoadingCities(false));
  }, [provinceId]);

  const inputClass = "mt-1.5 w-full rounded-xl border border-surface-variant bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary-fixed disabled:cursor-not-allowed disabled:bg-surface-low";
  const filteredProvinces = provinces.filter((item) => item.name.includes(provinceSearch));
  const filteredCities = cities.filter((name) => name.includes(citySearch));
  return <><label className="relative text-sm font-bold text-primary">استان *<input value={showProvinces ? provinceSearch : province} onFocus={() => { setProvinceSearch(""); setShowProvinces(true); }} onChange={(event) => { setProvinceSearch(event.target.value); setShowProvinces(true); }} placeholder="جستجو و انتخاب استان" className={inputClass} />{showProvinces && <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-surface-variant bg-white p-1 shadow-lg">{filteredProvinces.map((item) => <button type="button" key={item.id} onClick={() => { onChange({ province: item.name, city: "" }); setShowProvinces(false); }} className="block w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-surface-low">{item.name}</button>)}{filteredProvinces.length === 0 && <p className="p-3 text-center text-xs text-outline">استانی پیدا نشد</p>}</div>}</label><label className="relative text-sm font-bold text-primary">شهر *<input value={showCities ? citySearch : city} disabled={!provinceId || loadingCities} onFocus={() => { setCitySearch(""); setShowCities(true); }} onChange={(event) => { setCitySearch(event.target.value); setShowCities(true); }} placeholder={loadingCities ? "در حال دریافت شهرها..." : provinceId ? "جستجو و انتخاب شهر" : "ابتدا استان را انتخاب کنید"} className={inputClass} />{showCities && <div className="absolute z-30 mt-1 max-h-52 w-full overflow-y-auto rounded-xl border border-surface-variant bg-white p-1 shadow-lg">{filteredCities.map((name) => <button type="button" key={name} onClick={() => { onChange({ province, city: name }); setShowCities(false); }} className="block w-full rounded-lg px-3 py-2 text-right text-sm hover:bg-surface-low">{name}</button>)}{filteredCities.length === 0 && <p className="p-3 text-center text-xs text-outline">شهری پیدا نشد</p>}</div>}</label></>;
}
