"use client";

import { useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "watchlist";
const EVENT = "watchlist:changed";

export interface WatchItem {
  ticker: string;
  name?: string;
}

function read(): WatchItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: WatchItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  window.dispatchEvent(new Event(EVENT));
}

export function useWatchlist() {
  const [items, setItems] = useState<WatchItem[]>([]);

  useEffect(() => {
    setItems(read());
    const onChange = () => setItems(read());
    window.addEventListener(EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  const add = useCallback((item: WatchItem) => {
    const list = read();
    if (list.some((i) => i.ticker === item.ticker)) return;
    write([...list, item]);
  }, []);

  const remove = useCallback((ticker: string) => {
    write(read().filter((i) => i.ticker !== ticker));
  }, []);

  const has = useCallback((ticker: string) => items.some((i) => i.ticker === ticker), [items]);

  const toggle = useCallback((item: WatchItem) => {
    const list = read();
    if (list.some((i) => i.ticker === item.ticker)) {
      write(list.filter((i) => i.ticker !== item.ticker));
    } else {
      write([...list, item]);
    }
  }, []);

  return { items, add, remove, has, toggle };
}
