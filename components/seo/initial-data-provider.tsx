"use client";

import { createContext, useContext, type ReactNode } from "react";

const InitialDataContext = createContext<Record<string, unknown> | null>(null);

export function InitialDataProvider({ data, children }: { data: Record<string, unknown>; children: ReactNode }) {
  return <InitialDataContext.Provider value={data}>{children}</InitialDataContext.Provider>;
}

export function useInitialData<T>(key: string): T | null {
  return (useContext(InitialDataContext)?.[key] as T | undefined) || null;
}
