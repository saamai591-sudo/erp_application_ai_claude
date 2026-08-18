import { createRoot } from "react-dom/client";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/AuthContext";
import { TabsProvider } from "./lib/TabsContext";
import JournalEntries from "./pages/JournalEntries";
import "./styles.css";

localStorage.setItem("token", "faketoken");
localStorage.setItem("user", JSON.stringify({ id: 1, mobile: "0000000000", firstName: "تست", lastName: "کاربر" }));

const level3 = { id: 3, order: 3, title: "معین" };
const accounts = Array.from({ length: 5 }, (_, i) => ({
  id: 100 + i,
  parentId: null,
  code: String(100 + i),
  title: `حساب تستی ${i + 1}`,
  levelId: 3,
  level: level3,
  isCurrency: false,
  detailType1Id: null,
  detailType2Id: null,
  detailType3Id: null,
}));

const currencies = [{ id: 1, title: "ریال", isBase: true, decimalPlaces: 0, baseVolume: 1 }];
const docTypes = [{ id: 1, title: "سند عملیاتی", isSystem: true, systemKey: "OPERATIONAL" }];
const levels = [{ id: 3, order: 3, title: "معین" }];

const origFetch = window.fetch.bind(window);
(window as any).fetch = async (url: string, opts?: any) => {
  const u = url.toString();
  const json = (data: any, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  if (u.includes("/accounts")) return json(accounts);
  if (u.includes("/currencies")) return json(currencies);
  if (u.includes("/document-types")) return json(docTypes);
  if (u.includes("/reporting-levels")) return json(levels);
  return origFetch(url, opts);
};

const el = document.getElementById("root")!;
createRoot(el).render(
  <MemoryRouter initialEntries={["/journal-entries/new"]}>
    <AuthProvider>
      <TabsProvider>
        <Routes>
          <Route path="/journal-entries/new" element={<JournalEntries />} />
        </Routes>
      </TabsProvider>
    </AuthProvider>
  </MemoryRouter>
);
