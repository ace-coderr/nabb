import { Route, Routes, useLocation } from "react-router";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { CreateDrop } from "./pages/CreateDrop";
import { DropPage } from "./pages/DropPage";
import { Home } from "./pages/Home";
import { NotFound } from "./pages/NotFound";

export function App() {
  const { pathname } = useLocation();
  return (
    <div className="app">
      <Header />
      <main className="main">
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
      <Footer />
    </div>
  );
}
