import { useCallback, useState } from "react";
import { Route, Routes, useLocation } from "react-router";
import { ActivityProvider } from "./activity";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { LiveColumn } from "./components/LiveColumn";
import { LiveSheet } from "./components/LiveSheet";
import { TabBar } from "./components/TabBar";
import { Ticker } from "./components/Ticker";
import { CreateDrop } from "./pages/CreateDrop";
import { DropPage } from "./pages/DropPage";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";

const COLLAPSED_KEY = "nabb.live.collapsed";

/** Remembers the live column's collapsed state; storage may be unavailable, so never rely on it. */
function useCollapsed(): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSED_KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = useCallback(() => {
    setCollapsed((current) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, current ? "0" : "1");
      } catch {
        // Not persisted; the toggle still works for this visit.
      }
      return !current;
    });
  }, []);
  return [collapsed, toggle];
}

export function App() {
  const { pathname } = useLocation();
  const [collapsed, toggleCollapsed] = useCollapsed();
  const [sheetOpen, setSheetOpen] = useState(false);
  const closeSheet = useCallback(() => setSheetOpen(false), []);

  return (
    <ActivityProvider>
      <div className="app">
        <a className="skip-link" href="#main">
          Skip to content
        </a>
        <div className="chrome">
          <Header />
          <Ticker />
        </div>
        <div className="shell" data-live={collapsed ? "collapsed" : "open"}>
          <main id="main" tabIndex={-1} className="main">
            {/* Keyed by path so navigating away from a crashed page recovers. */}
            <ErrorBoundary key={pathname}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/create" element={<CreateDrop />} />
                <Route path="/drop/:dropId" element={<DropPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </ErrorBoundary>
          </main>
          <LiveColumn collapsed={collapsed} onToggle={toggleCollapsed} />
        </div>
        <Footer />
        <TabBar sheetOpen={sheetOpen} onToggleLive={() => setSheetOpen((open) => !open)} />
        {sheetOpen && <LiveSheet onClose={closeSheet} />}
      </div>
    </ActivityProvider>
  );
}
