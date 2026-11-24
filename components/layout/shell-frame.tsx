"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { SIDEBAR_COOKIE, TEXT_COOKIE } from "@/lib/layout/sidebar-pref";

type ShellState = {
  collapsed: boolean; toggle: () => void; // desktop sidebar
  menuOpen: boolean; setMenuOpen: (open: boolean) => void; // the "More" menu drawer on phones
  largeText: boolean; toggleLargeText: () => void; // "Bigger text"
};
const Ctx = createContext<ShellState>({ collapsed: false, toggle: () => {}, menuOpen: false, setMenuOpen: () => {}, largeText: false, toggleLargeText: () => {} });
export const useSidebar = () => useContext(Ctx);

const remember = (name: string, value: string) => { document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`; };

/**
 * Wraps the whole shell so the sidebar, the top bar and the phone bottom bar share one state.
 * Choices are kept in cookies, so the server renders the right layout on the next page load with no flicker.
 */
export function ShellFrame({ initialCollapsed, initialLargeText, children }: { initialCollapsed: boolean; initialLargeText: boolean; children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [menuOpen, setMenuOpen] = useState(false);
  const [largeText, setLargeText] = useState(initialLargeText);

  const toggle = useCallback(() => {
    setCollapsed((c) => { remember(SIDEBAR_COOKIE, c ? "0" : "1"); return !c; });
  }, []);
  const toggleLargeText = useCallback(() => {
    setLargeText((l) => {
      const next = !l;
      remember(TEXT_COOKIE, next ? "large" : "normal");
      document.documentElement.dataset.text = next ? "large" : "normal";
      return next;
    });
  }, []);

  const value = useMemo(() => ({ collapsed, toggle, menuOpen, setMenuOpen, largeText, toggleLargeText }), [collapsed, toggle, menuOpen, largeText, toggleLargeText]);
  return (
    <Ctx.Provider value={value}>
      <div className="app-shell min-h-screen" data-sidebar={collapsed ? "collapsed" : "open"}>{children}</div>
    </Ctx.Provider>
  );
}
