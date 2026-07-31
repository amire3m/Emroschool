"use client";

import { useEffect, useState } from "react";

interface Province { id: number; name: string; }

export default function IranLocationFields({ province, city, onChange }: { province: string; city: string; onChange: (values: { province: string; city: string }) => void }) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [loadingCities, setLoadingCities] = useState(false);
  const provinceId = provinces.find((item) => item.name === province)?.id;

  useEffect(() => { fetch("/api/locations").then((response) => response.json()).then((data) => setProvinces(data.provinces || [])).catch(() => {}); }, []);
  useEffect(() => {
    if (!provinceId) { setCities([]); return; }
    setLoadingCities(true);
    fetch(`/api/locations?provinceId=${provinceId}`).then((response) => response.json()).then((data) => setCities(data.cities || [])).catch(() => setCities([])).finally(() => setLoadingCities(false));
  }, [provinceId]);

  return <><label className="text-sm font-bold text-primary">استان *<select value={province} onChange={(event) => onChange({ province: event.target.value, city: "" })} className="mt-1.5 w-full rounded-xl border border-surface-variant bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary-fixed"><option value="">انتخاب استان</option>{province && !provinceId && <option value={province}>{province}</option>}{provinces.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}</select></label><label className="text-sm font-bold text-primary">شهر *<select value={city} disabled={!provinceId || loadingCities} onChange={(event) => onChange({ province, city: event.target.value })} className="mt-1.5 w-full rounded-xl border border-surface-variant bg-white px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-secondary-fixed disabled:cursor-not-allowed disabled:bg-surface-low"><option value="">{loadingCities ? "در حال دریافت شهرها..." : provinceId ? "انتخاب شهر" : "ابتدا استان را انتخاب کنید"}</option>{city && !cities.includes(city) && <option value={city}>{city}</option>}{cities.map((name) => <option key={name} value={name}>{name}</option>)}</select></label></>;
}
