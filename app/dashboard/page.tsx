"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAuth, UserButton } from "@clerk/nextjs";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { z } from "zod";
import { Check, Copy, Loader2, Plus, RefreshCcw, Search, Trash2, Upload } from "lucide-react";

type Restaurant = {
  id: string;
  name: string;
  city: string;
  address: string;
  phone?: string | null;
  status: "Draft" | "Creating" | "QR Ready" | "Connected" | "Disconnected";
  hours: { open_time: string; close_time: string } | null;
  socials: { instagram?: string; facebook?: string; website?: string } | null;
  google_maps_link?: string | null;
  logo_url?: string | null;
};

type AdminNumber = { id: string; phone: string; role: "admin"; is_active: boolean };
type Zone = {
  id: string;
  city: string;
  zone_name: string;
  delivery_fee: number;
  is_active: boolean;
  min_order_amount?: number | null;
  created_at?: string;
};

type Menu = { menu_image_url: string | null; menu_items_json?: unknown; updated_at?: string };
type Deal = {
  id: string;
  title: string;
  price: number | null;
  description: string | null;
  is_active: boolean;
  items_json?: any;
  created_at: string;
};
type BotSession = {
  id?: string;
  restaurant_id?: string;
  status: string;
  service_url: string | null;
  render_service_id?: string | null;
  qr_text?: string | null;
  qr_ready_at?: string | null;
  last_connected_at?: string | null;
  updated_at?: string;
};

type Order = {
  id: string;
  created_at: string;
  customer_phone: string;
  items: any;
  address: string;
  charges: number;
  total: number;
  status: string;
  zone: string;
  delivery_address?: string;
};

const CITY_OPTIONS = ["Karachi", "Hyderabad", "Islamabad"] as const;
type City = (typeof CITY_OPTIONS)[number];

const CITY_AREAS: Record<City, readonly string[]> = {
  Karachi: ["Gulshan", "Johar", "DHA", "Clifton", "North Nazimabad"],
  Hyderabad: ["Latifabad", "Qasimabad", "Autobahn"],
  Islamabad: ["F-6", "F-7", "G-10", "I-8"],
};

const RestaurantFormSchema = z.object({
  name: z.string().min(1),
  city: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().max(30).optional().or(z.literal("")),
  google_maps_link: z.string().optional(),
  open_time: z.string().min(1),
  close_time: z.string().min(1),
  instagram: z.string().optional(),
  facebook: z.string().optional(),
  website: z.string().optional(),
  logo_url: z.string().optional(),
});

type MenuItem = { id: string; name: string; price: number; description?: string };
type MenuCategory = { name: string; items: MenuItem[] };
type MenuRow = { id: string; category: string; name: string; price: number; description?: string };

function moneyPKR(n: number) {
  return n.toLocaleString(undefined, { style: "currency", currency: "PKR", maximumFractionDigits: 0 });
}

function formatCountdown(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function badgeTone(status: Restaurant["status"]) {
  if (status === "Connected") return "bg-green-50 text-green-700 border-green-200";
  if (status === "QR Ready") return "bg-blue-50 text-blue-700 border-blue-200";
  if (status === "Creating") return "bg-yellow-50 text-yellow-800 border-yellow-200";
  if (status === "Disconnected") return "bg-red-50 text-red-700 border-red-200";
  return "bg-neutral-50 text-neutral-700 border-neutral-200";
}

function errMsg(e: any) {
  if (typeof e?.message === "string") return e.message;
  if (typeof e?.error === "string") return e.error;
  const msg = String(e || "Unknown error");
  return msg === "[object Object]" ? "Unknown error" : msg;
}

function Toast({ toast, onClose }: { toast: { type: "success" | "error"; msg: string } | null; onClose: () => void }) {
  if (!toast) return null;
  return (
    <div className="fixed top-3 right-3 z-50 w-[min(360px,calc(100vw-24px))]">
      <div className={`rounded-2xl border bg-white p-3 shadow-lg ${toast.type === "error" ? "border-red-200" : "border-neutral-200"}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="text-sm">
            <div className="font-semibold">{toast.type === "error" ? "Error" : "Success"}</div>
            <div className="text-neutral-600 mt-1">{toast.msg}</div>
          </div>
          <button className="h-8 w-8 rounded-xl hover:bg-neutral-50" onClick={onClose}>x</button>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { isLoaded } = useAuth();

  // nav inside single page
  const [section, setSection] = useState<"restaurants" | "orders" | "settings">("restaurants");

  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const showError = (e: any) => setToast({ type: "error", msg: errMsg(e) });

  // global
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = useMemo(() => restaurants.find((r) => r.id === selectedId) || null, [restaurants, selectedId]);

  // details tabs
  const [tab, setTab] = useState<"setup" | "admins" | "zones" | "menu" | "deals" | "bot">("setup");

  // details data
  const [admins, setAdmins] = useState<AdminNumber[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [botSession, setBotSession] = useState<BotSession | null>(null);
  const [restaurantIdManual, setRestaurantIdManual] = useState("");
  const [qrRemainingMs, setQrRemainingMs] = useState(0);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // form state
  const [form, setForm] = useState({
    name: "",
    city: "Karachi",
    address: "",
    phone: "",
    google_maps_link: "",
    open_time: "10:00",
    close_time: "23:00",
    instagram: "",
    facebook: "",
    website: "",
    logo_url: "",
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // add restaurant modal-ish inline
  const [creating, setCreating] = useState(false);

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const isFormData = init?.body instanceof FormData;
  const res = await fetch(url, {
    ...init,
    headers: isFormData ? { ...(init?.headers || {}) } : { ...(init?.headers || {}), "Content-Type": "application/json" },
  });

  const contentType = res.headers.get("content-type") || "";
  const text = await res.text();

  let data: any = null;
  if (text && contentType.includes("application/json")) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    const msg =
      data?.error?.message ||
      data?.error ||
      text?.slice(0, 180) ||
      `Request failed (${res.status})`;
    throw new Error(msg);
  }

  return (data ?? {}) as T;
}


  async function loadRestaurants() {
    setLoadingRestaurants(true);
    try {
      const r = await api<{ data: Restaurant[] }>("/api/restaurants");
      setRestaurants(r.data || []);
      if (!selectedId && r.data?.[0]?.id) setSelectedId(r.data[0].id);
    } catch (e: any) {
      showError(e);
    } finally {
      setLoadingRestaurants(false);
    }
  }

  useEffect(() => {
    if (!isLoaded) return;
    loadRestaurants();
  }, [isLoaded]);

  // when restaurant selected, load all related (simple, minimal: only when needed by tab)
  useEffect(() => {
    if (!selectedId) return;
    // reset local views
    setAdmins([]);
    setZones([]);
    setMenu(null);
    setDeals([]);
    setBotSession(null);
    setMenuRows([]);
    setMenuCategories([]);
    setMenuImageUrl("");
    setMenuImageFile(null);
    setImportFile(null);
    setRestaurantIdManual(selectedId || "");

    // load restaurant fresh
    (async () => {
      try {
      const r = await api<{ data: Restaurant }>(`/api/restaurants/${selectedId}`);
        const rr = r.data;
        setForm({
          name: rr.name || "",
          city: rr.city || "Karachi",
          address: rr.address || "",
          phone: rr.phone || "",
          google_maps_link: rr.google_maps_link || "",
          open_time: rr.hours?.open_time || "10:00",
          close_time: rr.hours?.close_time || "23:00",
          instagram: rr.socials?.instagram || "",
          facebook: rr.socials?.facebook || "",
          website: rr.socials?.website || "",
          logo_url: rr.logo_url || "",
        });
        setFormErrors({});
      } catch (e: any) {
        showError(e);
      }
    })();
  }, [selectedId]);

  // Load menu for selected restaurant
  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      try {
        const res = await api<{ data: any | null }>(`/api/restaurants/${selectedId}/menu`, { method: "GET" });
        const m = res?.data;
        const incoming = m?.menu_items_json;
        setMenu(m || null);
        setMenuImageUrl(m?.menu_image_url || "");
        applyMenuJson(incoming);
      } catch (e: any) {
        showError(e);
      }
    })();
  }, [selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    if (tab === "zones") loadZones();
    if (tab === "deals") loadDeals();
  }, [selectedId, tab]);

  useEffect(() => {
    const readyAt = botSession?.qr_ready_at ? new Date(botSession.qr_ready_at).getTime() : null;
    if (!readyAt) {
      setQrRemainingMs(0);
      return;
    }
    const tick = () => setQrRemainingMs(Math.max(0, readyAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [botSession?.qr_ready_at]);

  async function saveRestaurant() {
    setFormErrors({});
    const parsed = RestaurantFormSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach((i) => (errs[i.path[0] as string] = i.message));
      setFormErrors(errs);
      setToast({ type: "error", msg: "Please fix required fields." });
      return;
    }
    if (!selectedId) return;

    try {
      await api(`/api/restaurants/${selectedId}`, {
        method: "PUT",
        body: JSON.stringify({
          name: form.name,
          city: form.city,
          address: form.address,
          phone: form.phone,
          google_maps_link: form.google_maps_link,
          hours: { open_time: form.open_time, close_time: form.close_time },
          socials: { instagram: form.instagram, facebook: form.facebook, website: form.website },
          logo_url: form.logo_url,
        }),
      });
      setToast({ type: "success", msg: "Restaurant saved." });
      await loadRestaurants();
    } catch (e: any) {
      showError(e);
    }
  }

  async function createRestaurant() {
    setCreating(true);
    try {
      const temp = {
        name: "New Restaurant",
        city: "Karachi",
        address: "Full address",
        phone: "",
        google_maps_link: "",
        hours: { open_time: "10:00", close_time: "23:00" },
        socials: { instagram: "", facebook: "", website: "" },
        logo_url: "",
      };
      const res = await api<{ data: Restaurant }>("/api/restaurants", {
        method: "POST",
        body: JSON.stringify(temp),
      });
      setToast({ type: "success", msg: "Restaurant created. Now update details." });
      await loadRestaurants();
      setSelectedId(res.data.id);
      setTab("setup");
    } catch (e: any) {
      showError(e);
    } finally {
      setCreating(false);
    }
  }

  // Admin numbers
  const [adminForm, setAdminForm] = useState({
    phone: "",
    is_active: true,
  });
  async function addAdmin() {
    if (!selectedId) return;
    if (!adminForm.phone.trim()) return setToast({ type: "error", msg: "Phone is required." });
    try {
      await api(`/api/restaurants/${selectedId}/admin-numbers`, {
        method: "POST",
        body: JSON.stringify({ ...adminForm, role: "admin" as const }),
      });
      setToast({ type: "success", msg: "Admin number added." });
      // minimal refresh: fetch via Supabase view if you have one. For now, rely on you adding GET endpoint later.
    } catch (e: any) {
      showError(e);
    }
  }

  // Delivery zones
  const [zoneFormErrors, setZoneFormErrors] = useState<{ zones?: string }>({});
  const [zoneForm, setZoneForm] = useState<{
    city: City;
    selectedAreas: string[];
  }>(() => {
    const city: City = "Karachi";
    return {
      city,
      selectedAreas: [],
    };
  });
  const [pendingZones, setPendingZones] = useState<
    Array<{ city: City; zone_name: string; delivery_fee: string; min_order_amount: string; is_active: boolean }>
  >([]);
  const [customAreaText, setCustomAreaText] = useState("");
  const customAreaInputRef = useRef<HTMLInputElement>(null);

  function normalizeAreaName(value: string) {
    return value.trim();
  }

  function isPredefinedArea(name: string, city: City) {
    const key = normalizeAreaName(name).toLowerCase();
    return (CITY_AREAS[city] || []).some((a) => a.toLowerCase() === key);
  }

  function uniqueAreas(names: string[]) {
    const seen = new Set<string>();
    const out: string[] = [];
    names.forEach((name) => {
      const key = normalizeAreaName(name).toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push(name);
    });
    return out;
  }

  async function loadZones() {
    if (!selectedId) return;
    try {
      const res = await api<{ data: Zone[] }>(`/api/restaurants/${selectedId}/delivery-zones`, { method: "GET" });
      setZones(res.data || []);
    } catch (e: any) {
      showError(e);
    }
  }

  async function addZone() {
    if (!selectedId) return;
    if (!pendingZones.length) {
      setZoneFormErrors({ zones: "Add at least one area before saving." });
      return;
    }
    setZoneFormErrors({});
    try {
        await api(`/api/restaurants/${selectedId}/delivery-zones`, {
          method: "POST",
          body: JSON.stringify({
            zones: pendingZones.map((zone) => ({
              city: zone.city,
              zone_name: zone.zone_name,
              delivery_fee: Number(zone.delivery_fee) || 0,
              min_order_amount: zone.min_order_amount ? Number(zone.min_order_amount) : 0,
              is_active: zone.is_active,
            })),
          }),
        });
        setToast({ type: "success", msg: "Zones saved." });
        setPendingZones([]);
        setZoneForm((p) => ({ ...p, selectedAreas: [] }));
        setCustomAreaText("");
        await loadZones();
      } catch (e: any) {
        showError(e);
      }
  }

  function addCustomArea() {
    const normalized = normalizeAreaName(customAreaText);
    if (!normalized) {
      setToast({ type: "error", msg: "Enter a valid area name." });
      return;
    }
    if (normalized.length > 40) {
      setToast({ type: "error", msg: "Area name must be 40 characters or less." });
      return;
    }
    const key = normalized.toLowerCase();
    const existsInSelected = zoneForm.selectedAreas.some((a) => normalizeAreaName(a).toLowerCase() === key);
    const existsInPending = pendingZones.some((z) => normalizeAreaName(z.zone_name).toLowerCase() === key);
    const existsInList = (CITY_AREAS[zoneForm.city] || []).some((a) => a.toLowerCase() === key);
    if (existsInSelected || existsInPending || existsInList) {
      setToast({ type: "error", msg: "Area already exists." });
      return;
    }
    setZoneForm((p) => ({ ...p, selectedAreas: uniqueAreas([...p.selectedAreas, normalized]) }));
    setPendingZones((prev) => [
      ...prev,
      { city: zoneForm.city, zone_name: normalized, delivery_fee: "", min_order_amount: "", is_active: true },
    ]);
    setCustomAreaText("");
    customAreaInputRef.current?.focus();
  }

  // Menu (import + items)
  const [menuCategories, setMenuCategories] = useState<MenuCategory[]>([]);
  const [menuRows, setMenuRows] = useState<MenuRow[]>([]);
  const [menuItemForm, setMenuItemForm] = useState({ category: "", item_name: "", price: "" });
  const [menuItemErrors, setMenuItemErrors] = useState<{ item_name?: string; price?: string }>({});
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [menuImageFile, setMenuImageFile] = useState<File | null>(null);
  const [menuImageUrl, setMenuImageUrl] = useState("");
  const [menuImageUploading, setMenuImageUploading] = useState(false);

  // Deals
  const [dealForm, setDealForm] = useState({
    title: "",
    price: "",
    description: "",
    is_active: true,
  });
  const [dealItemsText, setDealItemsText] = useState("");

  function slugify(value: string) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item";
  }

  function normalizeCategory(value: string) {
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed || "Uncategorized";
  }

  function normalizeHeader(header: string) {
    return header.replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  }

  function normalizeText(value: unknown) {
    return String(value ?? "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parsePrice(value: unknown) {
    const raw = normalizeText(value);
    if (!raw) return null;
    const cleaned = raw.replace(/[^\d.\-]/g, "");
    const num = Number(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  function categoriesToRows(cats: MenuCategory[]) {
    return cats.flatMap((cat) =>
      (cat.items || []).map((it) => ({
        id: String(it.id || ""),
        category: String(cat.name || "Uncategorized"),
        name: String(it.name || ""),
        price: Number(it.price ?? 0),
        description: typeof it.description === "string" && it.description.trim() ? it.description.trim() : undefined,
      }))
    );
  }

  function ensureRowIds(rows: MenuRow[]) {
    const counters = new Map<string, number>();
    return rows.map((row) => {
      const category = normalizeCategory(row.category);
      const name = row.name.trim();
      const price = row.price;
      const nextIndex = (counters.get(category) ?? 0) + 1;
      counters.set(category, nextIndex);
      const id = row.id?.trim() ? row.id.trim() : `${slugify(category)}-${slugify(name)}-${nextIndex}`;
      return {
        ...row,
        id,
        category,
        name,
        price,
        description: row.description?.trim() || undefined,
      };
    });
  }

  function rowsToCategories(rows: MenuRow[]) {
    const grouped = new Map<string, MenuItem[]>();
    rows.forEach((row) => {
      const category = normalizeCategory(row.category);
      const name = row.name.trim();
      if (!name || !Number.isFinite(row.price)) return;
      const entry: MenuItem = {
        id: row.id,
        name,
        price: row.price,
        ...(row.description?.trim() ? { description: row.description.trim() } : {}),
      };
      const menus = grouped.get(category) || [];
      menus.push(entry);
      grouped.set(category, menus);
    });
    return Array.from(grouped.entries()).map(([name, items]) => ({ name, items }));
  }

  function applyMenuJson(incoming: any) {
    let cats: MenuCategory[] = [];
    if (Array.isArray(incoming) && incoming.length && incoming[0]?.items) {
      cats = incoming.map((c: any) => ({
        name: String(c.name || "Uncategorized"),
        items: Array.isArray(c.items)
          ? c.items
              .map((it: any, idx: number) => ({
                id: String(it.id || `${idx + 1}`),
                name: String(it.name || ""),
                price: Number(it.price ?? 0),
                description: typeof it.description === "string" ? it.description : undefined,
              }))
              .filter((it: MenuItem) => it.name && Number.isFinite(it.price))
          : [],
      }));
    } else if (Array.isArray(incoming)) {
      const items: MenuItem[] = incoming
        .map((it: any, idx: number) => ({
          id: String(it.id || `${idx + 1}`),
          name: String(it.name || ""),
          price: Number(it.price ?? 0),
          description: typeof it.description === "string" ? it.description : undefined,
        }))
        .filter((it) => it.name && Number.isFinite(it.price));
      cats = items.length ? [{ name: "Uncategorized", items }] : [];
    }
    const rows = categoriesToRows(cats);
    setMenuCategories(cats);
    setMenuRows(rows);
  }

  function syncCategoriesFromRows(updated: MenuRow[]) {
    const normalizedRows = ensureRowIds(updated);
    setMenuRows(normalizedRows);
    setMenuCategories(rowsToCategories(normalizedRows));
  }

  function downloadMenuTemplate() {
    const header = "category,item_name,price,description\n";
    const sample = "Burgers,Classic Burger,450,Optional description\n";
    const blob = new Blob([header + sample], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "menu-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importMenuFile() {
    if (!selectedId) return;
    if (!importFile) return setToast({ type: "error", msg: "Pick a .xlsx or .csv file first." });
    setImporting(true);
    try {
      const fileName = importFile.name.toLowerCase();
      const isCsv = fileName.endsWith(".csv");
      const isXlsx = fileName.endsWith(".xlsx");
      if (!isCsv && !isXlsx) throw new Error("Only .csv and .xlsx files are supported.");

      const requiredHeaders = ["item_name", "price"];
      let rows: MenuRow[] = [];

      if (isCsv) {
        const text = await importFile.text();
        const parsed = Papa.parse<Record<string, unknown>>(text, { header: true, skipEmptyLines: true });
        if (parsed.errors.length) throw new Error(parsed.errors[0]?.message || "Failed to parse CSV.");
        const fields = parsed.meta.fields || [];
        const normalized = fields.map(normalizeHeader);
        const missing = requiredHeaders.filter((h) => !normalized.includes(h));
        if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);
        const fieldMap = new Map<string, string>();
        fields.forEach((field) => fieldMap.set(normalizeHeader(field), field));
        rows = (parsed.data || []).flatMap((row) => {
          const itemName = normalizeText(row[fieldMap.get("item_name") || ""]);
          const priceVal = parsePrice(row[fieldMap.get("price") || ""]);
          if (!itemName || priceVal === null) return [];
          const category = normalizeCategory(normalizeText(row[fieldMap.get("category") || ""]));
          const itemId = normalizeText(row[fieldMap.get("item_id") || ""]);
          const description = normalizeText(row[fieldMap.get("description") || ""]);
          return [
            {
              id: itemId,
              category,
              name: itemName,
              price: priceVal,
              description: description || undefined,
            },
          ];
        });
      } else {
        const buf = await importFile.arrayBuffer();
        const wb = XLSX.read(buf, { type: "array" });
        const sheetName = wb.SheetNames[0];
        if (!sheetName) throw new Error("Excel file is missing a worksheet.");
        const sheet = wb.Sheets[sheetName];
        const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][];
        if (!rawRows.length) throw new Error("Excel file is empty.");
        const headerRow = rawRows[0].map((h) => normalizeHeader(String(h ?? "")));
        const headerIndex = new Map(headerRow.map((h, idx) => [h, idx]));
        const missing = requiredHeaders.filter((h) => !headerIndex.has(h));
        if (missing.length) throw new Error(`Missing required columns: ${missing.join(", ")}.`);
        rows = rawRows.slice(1).flatMap((row) => {
          const itemName = normalizeText(row[headerIndex.get("item_name") ?? -1]);
          const priceVal = parsePrice(row[headerIndex.get("price") ?? -1]);
          if (!itemName || priceVal === null) return [];
          const category = normalizeCategory(normalizeText(row[headerIndex.get("category") ?? -1]));
          const itemId = normalizeText(row[headerIndex.get("item_id") ?? -1]);
          const description = normalizeText(row[headerIndex.get("description") ?? -1]);
          return [
            {
              id: itemId,
              category,
              name: itemName,
              price: priceVal,
              description: description || undefined,
            },
          ];
        });
      }

      if (!rows.length) throw new Error("No valid rows found in the file.");

      const normalizedRows = ensureRowIds(rows);
      setMenuRows(normalizedRows);
      setMenuCategories(rowsToCategories(normalizedRows));
      setToast({ type: "success", msg: `Imported ${normalizedRows.length} items.` });
    } catch (e: any) {
      showError(e);
    } finally {
      setImporting(false);
    }
  }

    async function uploadMenuImage() {
      if (!selectedId) return;
      if (!menuImageFile) return setToast({ type: "error", msg: "Choose an image first." });
      setMenuImageUploading(true);
      try {
        const form = new FormData();
        form.append("file", menuImageFile);
        const res = await api<{ ok: true; publicUrl: string }>(`/api/restaurants/${selectedId}/menu-image`, {
          method: "POST",
          body: form,
        });
        setMenuImageUrl(res.publicUrl);
        setToast({ type: "success", msg: "Menu image uploaded." });
      } catch (e: any) {
        showError(e);
      } finally {
        setMenuImageUploading(false);
    }
  }

  async function saveMenuImage() {
    if (!selectedId) return;
    if (!menuImageUrl) return setToast({ type: "error", msg: "Upload an image first." });
    try {
      await api(`/api/restaurants/${selectedId}/menu`, {
        method: "POST",
        body: JSON.stringify({ menu_image_url: menuImageUrl }),
      });
      setToast({ type: "success", msg: "Menu image saved." });
    } catch (e: any) {
      showError(e);
    }
  }

  function addMenuItem() {
    const errs: { item_name?: string; price?: string } = {};
    if (!menuItemForm.item_name.trim()) errs.item_name = "Item name is required.";
    const price = Number(menuItemForm.price);
    if (!menuItemForm.price.trim() || !Number.isFinite(price)) errs.price = "Price must be a number.";
    setMenuItemErrors(errs);
    if (Object.keys(errs).length) return;

    const newRow: MenuRow = {
      id: "",
      category: normalizeCategory(menuItemForm.category),
      name: menuItemForm.item_name.trim(),
      price,
    };
    syncCategoriesFromRows([...menuRows, newRow]);
    setMenuItemForm({ category: "", item_name: "", price: "" });
    setMenuItemErrors({});
  }

  async function saveMenu() {
    if (!selectedId) return;
    for (const row of menuRows) {
      if (!row.name.trim() || !Number.isFinite(row.price)) {
        return setToast({ type: "error", msg: "Please fix menu items (name and price required)." });
      }
    }
    const normalizedRows = ensureRowIds(menuRows);
    const categories = rowsToCategories(normalizedRows);
    if (!categories.length) return setToast({ type: "error", msg: "No items to save yet." });

    try {
      const payload: { menu_items_json: MenuCategory[]; menu_image_url?: string } = { menu_items_json: categories };
      if (menuImageUrl) payload.menu_image_url = menuImageUrl;
      await api(`/api/restaurants/${selectedId}/menu`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setMenuRows(normalizedRows);
      setMenuCategories(categories);
      setToast({ type: "success", msg: "Menu saved." });
    } catch (e: any) {
      showError(e);
    }
  }

  async function loadDeals() {
    if (!selectedId) return;
    try {
      const res = await api<{ data: Deal[] }>(`/api/restaurants/${selectedId}/deals`, { method: "GET" });
      setDeals(res.data || []);
    } catch (e: any) {
      showError(e);
    }
  }

  async function addDeal() {
    if (!selectedId) return;
    if (!dealForm.title.trim()) return setToast({ type: "error", msg: "Title is required." });
    const priceValue = dealForm.price.trim() ? Number(dealForm.price) : 0;
    if (!Number.isFinite(priceValue) || priceValue < 0) {
      return setToast({ type: "error", msg: "Price must be a number >= 0." });
    }
    const items = dealItemsText
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));
    try {
      await api(`/api/restaurants/${selectedId}/deals`, {
        method: "POST",
        body: JSON.stringify({
          title: dealForm.title.trim(),
          price: priceValue,
          description: dealForm.description.trim() || null,
          is_active: dealForm.is_active,
          items_json: { items },
        }),
      });
      setDealForm({ title: "", price: "", description: "", is_active: true });
      setDealItemsText("");
      setToast({ type: "success", msg: "Deal added." });
      await loadDeals();
    } catch (e: any) {
      showError(e);
    }
  }

  async function deleteDeal(id: string) {
    if (!selectedId) return;
    try {
      await api(`/api/restaurants/${selectedId}/deals/${id}`, { method: "DELETE" });
      setToast({ type: "success", msg: "Deal deleted." });
      await loadDeals();
    } catch (e: any) {
      showError(e);
    }
  }

  // Bot setup
  const [creatingBot, setCreatingBot] = useState(false);

  async function createBot() {
    if (!selectedId) return;
    if (!restaurantIdManual.trim()) return setToast({ type: "error", msg: "Restaurant ID is required." });
    setCreatingBot(true);
    try {
      const res = await api<{
        ok: true;
        service_url: string;
        render_service_id: string;
        qr_ready_at: string;
      }>("/api/create-bot", {
        method: "POST",
        body: JSON.stringify({ restaurant_id: restaurantIdManual.trim() }),
      });
      setToast({
        type: "success",
        msg: `Bot created. QR will be active in 2 hours at this link: ${res.service_url}/qr`,
      });
      await refreshBotStatus();
      await loadRestaurants();
    } catch (e: any) {
      showError(e);
    } finally {
      setCreatingBot(false);
    }
  }

  async function refreshBotStatus() {
    if (!selectedId) return;
    try {
      const res = await api<{ ok: true; session: BotSession | null }>(`/api/restaurants/${selectedId}/bot-session`);
      setBotSession(res.session);
      await loadRestaurants();
    } catch (e: any) {
      showError(e);
    }
  }

  // Orders (minimal: you should add GET endpoint in future; right now keep it simple by adding your own /api/orders if you want)
  async function loadOrders() {
    // You can implement /api/orders later. Keeping UI ready.
    setOrdersLoading(true);
    setTimeout(() => setOrdersLoading(false), 500);
  }

  useEffect(() => {
    if (section === "orders") loadOrders();
  }, [section]);

  if (!isLoaded) {
    return <div className="min-h-screen grid place-items-center text-sm text-neutral-600">Loading...</div>;
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <Toast toast={toast} onClose={() => setToast(null)} />

      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-40 bg-white border-b border-neutral-200">
        <div className="px-4 h-14 flex items-center justify-between">
          <div className="font-semibold">WhatsApp Bot Dashboard</div>
          <UserButton afterSignOutUrl="/sign-in" />
        </div>
      </div>

      <div className="mx-auto max-w-7xl lg:px-6 px-3 py-4 lg:py-8 grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
        {/* Sidebar */}
        <aside className="hidden lg:block">
          <div className="rounded-2xl border border-neutral-200 bg-white p-4 sticky top-6">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">WhatsApp Bot</div>
                <div className="text-xs text-neutral-500 mt-1">Minimal Restaurant Dashboard</div>
              </div>
              <UserButton afterSignOutUrl="/sign-in" />
            </div>

            <div className="mt-4 space-y-1">
              {[
                { key: "restaurants", label: "Restaurants" },
                { key: "orders", label: "Orders" },
                { key: "settings", label: "Settings" },
              ].map((it) => (
                <button
                  key={it.key}
                  onClick={() => setSection(it.key as any)}
                  className={`w-full text-left px-3 h-10 rounded-xl text-sm border transition ${
                    section === it.key ? "bg-black text-white border-black" : "bg-white border-neutral-200 hover:bg-neutral-50"
                  }`}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="space-y-4">
          {/* Top header */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
                <input
                  placeholder="Search (UI only)"
                  className="h-10 w-full rounded-xl border border-neutral-200 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-neutral-200"
                />
              </div>
              <button
                onClick={() => loadRestaurants()}
                className="h-10 px-3 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50 inline-flex items-center gap-2"
              >
                <RefreshCcw className="h-4 w-4" />
                Refresh
              </button>
            </div>
          </div>

          {/* Restaurants */}
          {section === "restaurants" && (
            <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
              {/* Left list */}
              <div className="rounded-2xl border border-neutral-200 bg-white">
                <div className="p-4 border-b border-neutral-200 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">Busineses</div>
                    <div className="text-xs text-neutral-500 mt-1">Select to manage setup and bot</div>
                  </div>
                  <button
                    onClick={createRestaurant}
                    disabled={creating}
                    className="h-10 px-3 rounded-xl bg-black text-white text-sm hover:bg-neutral-800 inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                    Add
                  </button>
                </div>

                {loadingRestaurants ? (
                  <div className="p-4 space-y-3">
                    <div className="h-20 rounded-xl bg-neutral-100 animate-pulse" />
                    <div className="h-20 rounded-xl bg-neutral-100 animate-pulse" />
                    <div className="h-20 rounded-xl bg-neutral-100 animate-pulse" />
                  </div>
                ) : restaurants.length === 0 ? (
                  <div className="p-6 text-sm text-neutral-600">No Business yet. Click Add.</div>
                ) : (
                  <div className="p-2">
                    {restaurants.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setSelectedId(r.id); setTab("setup"); }}
                        className={`w-full text-left p-3 rounded-xl border mb-2 transition ${
                          selectedId === r.id ? "border-black bg-neutral-50" : "border-neutral-200 hover:bg-neutral-50"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">{r.name}</div>
                            <div className="text-xs text-neutral-600 mt-1">{r.city}</div>
                          </div>
                          <span className={`text-xs px-2.5 py-1 rounded-full border ${badgeTone(r.status)}`}>
                            {r.status}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <span className="text-xs text-neutral-500">Manage</span>
                          <span className="text-xs text-neutral-400">Ã¢â‚¬Â¢</span>
                          <span className="text-xs text-neutral-500">QR Link</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Right details */}
              <div className="rounded-2xl border border-neutral-200 bg-white">
                <div className="p-4 border-b border-neutral-200">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-semibold">{selected ? selected.name : "Select a restaurant"}</div>
                      <div className="text-xs text-neutral-500 mt-1">
                        {selected ? "Setup, create bot, and manage orders" : "Choose from the left list"}
                      </div>
                    </div>
                    {selected ? (
                      <span className={`text-xs px-2.5 py-1 rounded-full border ${badgeTone(selected.status)}`}>
                        {selected.status}
                      </span>
                    ) : null}
                  </div>

                  {/* tabs */}
                  <div className="mt-4 flex flex-wrap gap-2">
                    {[
                      { key: "setup", label: "Business Setup" },
                      { key: "admins", label: "Admin Numbers" },
                      { key: "zones", label: "Delivery Zones" },
                      { key: "menu", label: "Menu" },
                      { key: "deals", label: "Deals" },
                      { key: "bot", label: "Bot Setup" },
                    ].map((t) => (
                      <button
                        key={t.key}
                        onClick={() => setTab(t.key as any)}
                        className={`h-9 px-3 rounded-xl text-sm border transition ${
                          tab === t.key ? "bg-black text-white border-black" : "bg-white border-neutral-200 hover:bg-neutral-50"
                        }`}
                        disabled={!selected}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                {!selected ? (
                  <div className="p-6 text-sm text-neutral-600">Pick a restaurant to continue.</div>
                ) : (
                  <div className="p-4 space-y-5">
                    {/* Setup */}
                    {tab === "setup" && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <Field label="Business Name" required error={formErrors.name}>
                            <input
                              value={form.name}
                              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                              className={inputClass(formErrors.name)}
                              placeholder="e.g. Zaiqa House"
                            />
                          </Field>
                          <Field label="City" required error={formErrors.city}>
                            <select
                              value={form.city}
                              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value as City }))}
                              className={inputClass(formErrors.city)}
                            >
                              {CITY_OPTIONS.map((c) => (
                                <option key={c} value={c}>
                                  {c}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label="Full Address" required error={formErrors.address} className="sm:col-span-2">
                            <input
                              value={form.address}
                              onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                              className={inputClass(formErrors.address)}
                              placeholder="Full delivery address"
                            />
                          </Field>
                          <Field label="Phone Number" error={formErrors.phone} className="sm:col-span-2">
                            <input
                              value={form.phone}
                              onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                              className={inputClass(formErrors.phone)}
                              placeholder="+92 3xx xxxxxxx"
                            />
                          </Field>
                          <Field label="Google Maps Link" error={formErrors.google_maps_link} className="sm:col-span-2">
                            <input
                              value={form.google_maps_link}
                              onChange={(e) => setForm((p) => ({ ...p, google_maps_link: e.target.value }))}
                              className={inputClass(formErrors.google_maps_link)}
                              placeholder="https://maps.google.com/..."
                            />
                          </Field>

                          <Field label="Open Time" required error={formErrors.open_time}>
                            <input
                              type="time"
                              value={form.open_time}
                              onChange={(e) => setForm((p) => ({ ...p, open_time: e.target.value }))}
                              className={inputClass(formErrors.open_time)}
                            />
                          </Field>
                          <Field label="Close Time" required error={formErrors.close_time}>
                            <input
                              type="time"
                              value={form.close_time}
                              onChange={(e) => setForm((p) => ({ ...p, close_time: e.target.value }))}
                              className={inputClass(formErrors.close_time)}
                            />
                          </Field>

                          <Field label="Instagram" className="sm:col-span-2">
                            <input
                              value={form.instagram}
                              onChange={(e) => setForm((p) => ({ ...p, instagram: e.target.value }))}
                              className={inputClass()}
                              placeholder="https://instagram.com/..."
                            />
                          </Field>
                          <Field label="Facebook" className="sm:col-span-2">
                            <input
                              value={form.facebook}
                              onChange={(e) => setForm((p) => ({ ...p, facebook: e.target.value }))}
                              className={inputClass()}
                              placeholder="https://facebook.com/..."
                            />
                          </Field>
                          <Field label="Website" className="sm:col-span-2">
                            <input
                              value={form.website}
                              onChange={(e) => setForm((p) => ({ ...p, website: e.target.value }))}
                              className={inputClass()}
                              placeholder="https://..."
                            />
                          </Field>

                          <Field label="Logo URL (optional)" className="sm:col-span-2">
                            <input
                              value={form.logo_url}
                              onChange={(e) => setForm((p) => ({ ...p, logo_url: e.target.value }))}
                              className={inputClass()}
                              placeholder="Paste logo URL (or integrate storage upload later)"
                            />
                          </Field>
                        </div>

                        {form.logo_url ? (
                          <div className="rounded-2xl border border-neutral-200 p-3 flex items-center gap-3">
                            <img src={form.logo_url} alt="Logo preview" className="h-12 w-12 rounded-xl object-cover border border-neutral-200" />
                            <div className="text-xs text-neutral-600">Logo preview</div>
                          </div>
                        ) : null}

                        <div className="flex flex-col sm:flex-row gap-2">
                          <button onClick={saveRestaurant} className="h-10 px-4 rounded-xl bg-black text-white text-sm hover:bg-neutral-800">
                            Save
                          </button>
                          <button
                            onClick={() => {
                              // reload selected
                              setSelectedId(selected.id);
                              setToast({ type: "success", msg: "Changes reverted." });
                            }}
                            className="h-10 px-4 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Admin Numbers */}
                    {tab === "admins" && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-neutral-200 p-4">
                          <div className="text-sm font-semibold">Add Admin Number</div>
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Phone" required>
                              <input
                                value={adminForm.phone}
                                onChange={(e) => setAdminForm((p) => ({ ...p, phone: e.target.value }))}
                                className={inputClass()}
                                placeholder="+92 3xx xxxxxxx"
                              />
                            </Field>
                            <Field label="Active">
                              <label className="h-10 px-3 rounded-xl border border-neutral-200 flex items-center justify-between text-sm">
                                <span className="text-neutral-600">is_active</span>
                                <input
                                  type="checkbox"
                                  checked={adminForm.is_active}
                                  onChange={(e) => setAdminForm((p) => ({ ...p, is_active: e.target.checked }))}
                                />
                              </label>
                            </Field>
                          </div>
                          <div className="mt-3">
                            <button onClick={addAdmin} className="h-10 px-4 rounded-xl bg-black text-white text-sm hover:bg-neutral-800">
                              Add
                            </button>
                          </div>
                          <div className="mt-3 text-xs text-neutral-500">
                            UI ready. Add GET endpoint to list admins if you want live table here.
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Delivery Zones */}
                    {tab === "zones" && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-neutral-200 p-4">
                          <div className="text-sm font-semibold">Add Delivery Zone</div>
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="City" required>
                              <select
                                value={zoneForm.city}
                                onChange={(e) => {
                                  const city = e.target.value as City;
                                  setZoneForm((p) => ({ ...p, city, selectedAreas: [] }));
                                  setPendingZones([]);
                                  setZoneFormErrors({});
                                  setCustomAreaText("");
                                }}
                                className={inputClass()}
                              >
                                {CITY_OPTIONS.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            </Field>
                            <Field label="Areas" required>
                              <select
                                multiple
                                value={zoneForm.selectedAreas}
                                onChange={(e) => {
                                  const selected = Array.from(e.target.selectedOptions).map((o) => o.value);
                                  const customNames = pendingZones
                                    .filter((z) => !isPredefinedArea(z.zone_name, zoneForm.city))
                                    .map((z) => z.zone_name);
                                  setZoneForm((p) => ({ ...p, selectedAreas: uniqueAreas([...selected, ...customNames]) }));
                                  setPendingZones((prev) => {
                                    const customPrev = prev
                                      .filter((z) => !isPredefinedArea(z.zone_name, zoneForm.city))
                                      .map((z) => z.zone_name);
                                    const keepKeys = new Set(
                                      [...selected, ...customPrev].map((name) => normalizeAreaName(name).toLowerCase())
                                    );
                                    const kept = prev.filter((z) =>
                                      keepKeys.has(normalizeAreaName(z.zone_name).toLowerCase())
                                    );
                                    const existing = new Set(kept.map((z) => normalizeAreaName(z.zone_name).toLowerCase()));
                                    const additions = selected
                                      .filter((name) => !existing.has(normalizeAreaName(name).toLowerCase()))
                                      .map((name) => ({
                                        city: zoneForm.city,
                                        zone_name: name,
                                        delivery_fee: "",
                                        min_order_amount: "",
                                        is_active: true,
                                      }));
                                    return [...kept, ...additions];
                                  });
                                  setZoneFormErrors({});
                                }}
                                className={`${inputClass()} h-28`}
                              >
                                {(CITY_AREAS[zoneForm.city] || []).map((a) => (
                                  <option key={a} value={a}>
                                    {a}
                                  </option>
                                ))}
                              </select>
                              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                <input
                                  ref={customAreaInputRef}
                                  value={customAreaText}
                                  onChange={(e) => setCustomAreaText(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      addCustomArea();
                                    }
                                  }}
                                  maxLength={40}
                                  placeholder="Add custom area"
                                  className={inputClass()}
                                />
                                <button
                                  type="button"
                                  onClick={addCustomArea}
                                  className="h-10 px-4 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50"
                                >
                                  Add
                                </button>
                              </div>
                            </Field>
                          </div>
                          {zoneFormErrors.zones ? <div className="text-xs text-red-600 mt-2">{zoneFormErrors.zones}</div> : null}
                          <div className="mt-4 rounded-2xl border border-neutral-200 overflow-hidden">
                            <div className="grid grid-cols-[1fr_140px_140px_120px_44px] gap-0 bg-neutral-50 text-xs text-neutral-600 px-3 py-2">
                              <div>Area</div>
                              <div>Delivery Fee</div>
                              <div>Min Order</div>
                              <div>Active</div>
                              <div />
                            </div>
                            {pendingZones.length === 0 ? (
                              <div className="p-3 text-sm text-neutral-600">No pending areas yet.</div>
                            ) : (
                              <div className="divide-y divide-neutral-200">
                                {pendingZones.map((zone, idx) => (
                                  <div key={zone.zone_name} className="grid grid-cols-[1fr_140px_140px_120px_44px] gap-0 px-3 py-2 items-center text-sm">
                                    <div>{zone.zone_name}</div>
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min={0}
                                      value={zone.delivery_fee}
                                      onChange={(e) =>
                                        setPendingZones((prev) =>
                                          prev.map((z, i) => (i === idx ? { ...z, delivery_fee: e.target.value } : z))
                                        )
                                      }
                                      className={inputClass()}
                                    />
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      min={0}
                                      value={zone.min_order_amount}
                                      onChange={(e) =>
                                        setPendingZones((prev) =>
                                          prev.map((z, i) => (i === idx ? { ...z, min_order_amount: e.target.value } : z))
                                        )
                                      }
                                      className={inputClass()}
                                    />
                                    <label className="h-10 px-3 rounded-xl border border-neutral-200 flex items-center justify-between text-sm">
                                      <span className="text-neutral-600">is_active</span>
                                      <input
                                        type="checkbox"
                                        checked={zone.is_active}
                                        onChange={(e) =>
                                          setPendingZones((prev) =>
                                            prev.map((z, i) => (i === idx ? { ...z, is_active: e.target.checked } : z))
                                          )
                                        }
                                      />
                                    </label>
                                      <button
                                        onClick={() => {
                                          const removed = pendingZones[idx]?.zone_name;
                                          setPendingZones((prev) => prev.filter((_, i) => i !== idx));
                                          if (removed) {
                                            setZoneForm((p) => ({
                                              ...p,
                                              selectedAreas: p.selectedAreas.filter((name) => name !== removed),
                                            }));
                                          }
                                        }}
                                        className="h-10 w-10 rounded-xl border border-neutral-200 hover:bg-neutral-50 inline-flex items-center justify-center"
                                        aria-label="Remove area"
                                      >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="mt-3">
                            <button onClick={addZone} className="h-10 px-4 rounded-xl bg-black text-white text-sm hover:bg-neutral-800">
                              Save Zone(s)
                            </button>
                          </div>
                        </div>

                        <div className="rounded-2xl border border-neutral-200 overflow-hidden">
                          <div className="grid grid-cols-[1fr_1fr_140px_140px_100px] gap-0 bg-neutral-50 text-xs text-neutral-600 px-3 py-2">
                            <div>City</div>
                            <div>Area</div>
                            <div>Charges</div>
                            <div>Min Order</div>
                            <div>Status</div>
                          </div>
                          {zones.length === 0 ? (
                            <div className="p-3 text-sm text-neutral-600">No zones saved yet.</div>
                          ) : (
                            <div className="divide-y divide-neutral-200">
                              {zones.map((zone) => (
                                <div key={zone.id} className="grid grid-cols-[1fr_1fr_140px_140px_100px] gap-0 px-3 py-2 text-sm items-center">
                                  <div>{zone.city}</div>
                                  <div>{zone.zone_name}</div>
                                  <div>{moneyPKR(zone.delivery_fee)}</div>
                                  <div>{zone.min_order_amount ? moneyPKR(zone.min_order_amount) : "-"}</div>
                                  <div>{zone.is_active ? "Active" : "Inactive"}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Menu */}
                    {tab === "menu" && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-neutral-200 p-4">
                          <div className="rounded-2xl border border-neutral-200 p-4">
                            <div className="text-sm font-semibold">Menu Image Upload</div>
                            <div className="mt-2 text-xs text-neutral-500">Upload a menu image and save its URL.</div>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => setMenuImageFile(e.target.files?.[0] || null)}
                                className={inputClass()}
                              />
                              <button
                                onClick={uploadMenuImage}
                                disabled={menuImageUploading}
                                className="h-10 px-4 rounded-xl bg-black text-white text-sm hover:bg-neutral-800 inline-flex items-center gap-2 disabled:opacity-50"
                              >
                                {menuImageUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {menuImageUploading ? "Uploading..." : "Upload"}
                              </button>
                              <button
                                onClick={saveMenuImage}
                                className="h-10 px-4 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50"
                              >
                                Save Image
                              </button>
                            </div>
                            <div className="mt-2 text-xs text-neutral-500">Selected: {menuImageFile?.name || "No file selected"}</div>
                            {menuImageUrl ? (
                              <div className="mt-3 rounded-2xl border border-neutral-200 p-3">
                                <div className="text-xs text-neutral-500 mb-2">Preview</div>
                                <img src={menuImageUrl} alt="Menu preview" className="w-full max-h-60 object-contain rounded-xl" />
                              </div>
                            ) : null}
                          </div>

                          <div className="rounded-2xl border border-neutral-200 p-4">
                            <div className="text-sm font-semibold">Import Menu</div>
                            <div className="mt-2 text-xs text-neutral-500">
                              Upload a CSV or Excel file with category, item_name, and price columns.
                            </div>
                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                              <input
                                type="file"
                                accept=".csv,.xlsx"
                                onChange={(e) => setImportFile(e.target.files?.[0] || null)}
                                className={inputClass()}
                              />
                              <button
                                onClick={importMenuFile}
                                disabled={importing}
                                className="h-10 px-4 rounded-xl bg-black text-white text-sm hover:bg-neutral-800 inline-flex items-center gap-2 disabled:opacity-50"
                              >
                                {importing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                                {importing ? "Importing..." : "Import Menu"}
                              </button>
                            </div>
                            <div className="mt-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-neutral-500">
                              <div>Selected: {importFile?.name || "No file selected"}</div>
                              <button onClick={downloadMenuTemplate} className="underline hover:text-neutral-800">
                                Download Template
                              </button>
                            </div>
                          </div>

                          <div className="rounded-2xl border border-neutral-200 p-4">
                            <div className="text-sm font-semibold">Menu Items</div>
                            <div className="mt-2 text-xs text-neutral-500">
                              Import a file or add items manually below.
                            </div>

                            <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                              <Field label="Category">
                                <input
                                  value={menuItemForm.category}
                                  onChange={(e) => setMenuItemForm((p) => ({ ...p, category: e.target.value }))}
                                  className={inputClass()}
                                  placeholder="e.g. Burgers"
                                />
                              </Field>
                              <Field label="Item Name" required error={menuItemErrors.item_name}>
                                <input
                                  value={menuItemForm.item_name}
                                  onChange={(e) => {
                                    setMenuItemForm((p) => ({ ...p, item_name: e.target.value }));
                                    setMenuItemErrors((p) => ({ ...p, item_name: undefined }));
                                  }}
                                  className={inputClass(menuItemErrors.item_name)}
                                  placeholder="e.g. Zinger Burger"
                                />
                              </Field>
                              <Field label="Price (PKR)" required error={menuItemErrors.price}>
                                <input
                                  type="number"
                                  inputMode="numeric"
                                  value={menuItemForm.price}
                                  onChange={(e) => {
                                    setMenuItemForm((p) => ({ ...p, price: e.target.value }));
                                    setMenuItemErrors((p) => ({ ...p, price: undefined }));
                                  }}
                                  className={inputClass(menuItemErrors.price)}
                                  placeholder="e.g. 450"
                                />
                              </Field>
                            </div>

                            <div className="mt-3 flex gap-2">
                              <button
                                onClick={addMenuItem}
                                className="h-10 px-4 rounded-xl bg-black text-white text-sm hover:bg-neutral-800"
                              >
                                Add item
                              </button>
                              <button
                                onClick={() => {
                                  setMenuRows([]);
                                  setMenuCategories([]);
                                  setMenuItemForm({ category: "", item_name: "", price: "" });
                                  setMenuItemErrors({});
                                  setToast({ type: "success", msg: "Items cleared." });
                                }}
                                className="h-10 px-4 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50"
                              >
                                Clear
                              </button>
                            </div>

                            <div className="mt-4 rounded-2xl border border-neutral-200 overflow-hidden">
                              <div className="grid grid-cols-[160px_1fr_120px_44px] gap-0 bg-neutral-50 text-xs text-neutral-600 px-3 py-2">
                                <div>Category</div>
                                <div>Item Name</div>
                                <div>Price</div>
                                <div />
                              </div>
                              {menuRows.length === 0 ? (
                                <div className="p-3 text-sm text-neutral-600">No items yet.</div>
                              ) : (
                                <div className="divide-y divide-neutral-200">
                                  {menuRows.map((it, idx) => (
                                    <div key={`${it.id || "row"}-${idx}`} className="grid grid-cols-[160px_1fr_120px_44px] gap-0 px-3 py-2 items-center">
                                      <input
                                        value={it.category}
                                        onChange={(e) =>
                                          syncCategoriesFromRows(menuRows.map((x, i) => (i === idx ? { ...x, category: e.target.value } : x)))
                                        }
                                        className={inputClass()}
                                      />
                                      <input
                                        value={it.name}
                                        onChange={(e) =>
                                          syncCategoriesFromRows(menuRows.map((x, i) => (i === idx ? { ...x, name: e.target.value } : x)))
                                        }
                                        className={inputClass()}
                                      />
                                      <input
                                        type="number"
                                        inputMode="numeric"
                                        value={it.price}
                                        onChange={(e) =>
                                          syncCategoriesFromRows(
                                            menuRows.map((x, i) => (i === idx ? { ...x, price: Number(e.target.value) } : x))
                                          )
                                        }
                                        className={inputClass()}
                                      />
                                      <button
                                        onClick={() => syncCategoriesFromRows(menuRows.filter((_, i) => i !== idx))}
                                        className="h-10 w-10 rounded-xl border border-neutral-200 hover:bg-neutral-50 inline-flex items-center justify-center"
                                        aria-label="Remove item"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-neutral-200 p-4">
                            <div className="text-sm font-semibold">Save Menu</div>
                            <div className="mt-3 flex flex-col sm:flex-row gap-2">
                              <button onClick={saveMenu} className="h-10 px-4 rounded-xl bg-black text-white text-sm hover:bg-neutral-800">
                                Save menu
                              </button>
                              <div className="text-xs text-neutral-500 flex items-center">
                                Saves `menu_items_json` for this restaurant.
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Deals */}
                    {tab === "deals" && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-neutral-200 p-4">
                          <div className="text-sm font-semibold">Create Deal</div>
                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <Field label="Title" required>
                              <input
                                value={dealForm.title}
                                onChange={(e) => setDealForm((p) => ({ ...p, title: e.target.value }))}
                                className={inputClass()}
                                placeholder="e.g. Burger + Drink"
                              />
                            </Field>
                            <Field label="Price (PKR)">
                              <input
                                type="number"
                                inputMode="numeric"
                                value={dealForm.price}
                                onChange={(e) => setDealForm((p) => ({ ...p, price: e.target.value }))}
                                className={inputClass()}
                                placeholder="e.g. 599"
                              />
                            </Field>
                            <Field label="Description" className="sm:col-span-2">
                              <input
                                value={dealForm.description}
                                onChange={(e) => setDealForm((p) => ({ ...p, description: e.target.value }))}
                                className={inputClass()}
                                placeholder="Optional details"
                              />
                            </Field>
                              <Field label="Active">
                                <label className="h-10 px-3 rounded-xl border border-neutral-200 flex items-center justify-between text-sm">
                                  <span className="text-neutral-600">is_active</span>
                                  <input
                                    type="checkbox"
                                    checked={dealForm.is_active}
                                    onChange={(e) => setDealForm((p) => ({ ...p, is_active: e.target.checked }))}
                                  />
                                </label>
                              </Field>
                            </div>

                            <div className="mt-4">
                              <div className="text-sm font-semibold">Deal Items</div>
                              <div className="mt-2 text-xs text-neutral-500">One item per line.</div>
                              <Field label="Deal items (one per line)" className="mt-3">
                                <textarea
                                  value={dealItemsText}
                                  onChange={(e) => setDealItemsText(e.target.value)}
                                  rows={4}
                                  className={`${inputClass()} h-auto py-2`}
                                  placeholder="e.g. Zinger Burger&#10;Fries&#10;Drink"
                                />
                              </Field>
                            </div>
                            <div className="mt-3">
                              <button onClick={addDeal} className="h-10 px-4 rounded-xl bg-black text-white text-sm hover:bg-neutral-800">
                                Add Deal
                              </button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-neutral-200 overflow-hidden">
                          <div className="grid grid-cols-[1fr_120px_120px_80px] gap-0 bg-neutral-50 text-xs text-neutral-600 px-3 py-2">
                            <div>Title</div>
                            <div>Price</div>
                            <div>Status</div>
                            <div />
                          </div>
                          {deals.length === 0 ? (
                            <div className="p-3 text-sm text-neutral-600">No deals yet.</div>
                          ) : (
                            <div className="divide-y divide-neutral-200">
                              {deals.map((deal) => (
                                <div key={deal.id} className="grid grid-cols-[1fr_120px_120px_80px] gap-0 px-3 py-2 text-sm items-center">
                                  <div>
                                    <div className="font-medium">{deal.title}</div>
                                    {deal.description ? <div className="text-xs text-neutral-500">{deal.description}</div> : null}
                                    {Array.isArray(deal.items_json?.items) ? (
                                      <div className="text-xs text-neutral-500">{deal.items_json.items.length} items</div>
                                    ) : null}
                                  </div>
                                  <div>{deal.price !== null ? moneyPKR(deal.price) : "-"}</div>
                                  <div>{deal.is_active ? "Active" : "Inactive"}</div>
                                  <button
                                    onClick={() => deleteDeal(deal.id)}
                                    className="h-9 w-9 rounded-xl border border-neutral-200 hover:bg-neutral-50 inline-flex items-center justify-center"
                                    aria-label="Delete deal"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Bot Setup */}
                    {tab === "bot" && (
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-neutral-200 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold">Bot Setup</div>
                              <div className="text-xs text-neutral-500 mt-1">Create service on Render. Show QR link to scan.</div>
                            </div>
                            <button
                              onClick={refreshBotStatus}
                              disabled={qrRemainingMs > 0}
                              className="h-10 px-3 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50 inline-flex items-center gap-2"
                            >
                              <RefreshCcw className="h-4 w-4" />
                              Refresh
                            </button>
                          </div>

                          <div className="mt-3 grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                            <Field label="Restaurant ID (manual)" required>
                              <input
                                value={restaurantIdManual}
                                onChange={(e) => setRestaurantIdManual(e.target.value)}
                                className={inputClass()}
                                placeholder="UUID"
                              />
                            </Field>
                            <button
                              onClick={createBot}
                              disabled={creatingBot}
                              className="h-10 px-4 rounded-xl bg-black text-white text-sm hover:bg-neutral-800 inline-flex items-center gap-2 disabled:opacity-50"
                            >
                              {creatingBot ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              Create Bot
                            </button>
                          </div>
                          {qrRemainingMs > 0 ? (
                            <div className="mt-2 text-xs text-neutral-500">
                              QR will be active in {formatCountdown(qrRemainingMs)}.
                            </div>
                          ) : null}

                          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="rounded-2xl border border-neutral-200 p-3">
                              <div className="text-xs text-neutral-500">Service URL</div>
                              <div className="text-sm font-semibold mt-1 break-all">{botSession?.service_url || "Not created yet"}</div>
                            </div>
                            <div className="rounded-2xl border border-neutral-200 p-3">
                              <div className="text-xs text-neutral-500">QR Link</div>
                              <div className="mt-1 flex items-center gap-2">
                                <input
                                  readOnly
                                  value={botSession?.service_url ? `${botSession.service_url}/qr` : ""}
                                  className="h-10 w-full rounded-xl border border-neutral-200 px-3 text-sm"
                                  placeholder="Will appear after Create Bot"
                                />
                                <button
                                  onClick={() => {
                                    const link = botSession?.service_url ? `${botSession.service_url}/qr` : "";
                                    if (!link) return;
                                    navigator.clipboard.writeText(link);
                                    setToast({ type: "success", msg: "QR link copied." });
                                  }}
                                  className="h-10 w-10 rounded-xl border border-neutral-200 hover:bg-neutral-50 inline-flex items-center justify-center"
                                >
                                  <Copy className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl border border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-500">
                            QR will appear here (your bot service shows it on /qr)
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Orders */}
          {section === "orders" && (
            <div className="rounded-2xl border border-neutral-200 bg-white">
              <div className="p-4 border-b border-neutral-200 flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">Orders</div>
                  <div className="text-xs text-neutral-500 mt-1">Hook this to your real orders GET endpoint or realtime.</div>
                </div>
                <button
                  onClick={loadOrders}
                  className="h-10 px-3 rounded-xl border border-neutral-200 text-sm hover:bg-neutral-50 inline-flex items-center gap-2"
                >
                  <RefreshCcw className="h-4 w-4" />
                  Refresh
                </button>
              </div>

              <div className="p-4">
                {ordersLoading ? (
                  <div className="space-y-3">
                    <div className="h-12 rounded-xl bg-neutral-100 animate-pulse" />
                    <div className="h-12 rounded-xl bg-neutral-100 animate-pulse" />
                    <div className="h-12 rounded-xl bg-neutral-100 animate-pulse" />
                  </div>
                ) : (
                  <div className="text-sm text-neutral-600">
                    UI ready. Add `/api/orders?restaurant_id=...` later for real data.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Settings */}
          {section === "settings" && (
            <div className="rounded-2xl border border-neutral-200 bg-white">
              <div className="p-4 border-b border-neutral-200">
                <div className="text-sm font-semibold">Settings</div>
                <div className="text-xs text-neutral-500 mt-1">Minimal toggles. UI only.</div>
              </div>
              <div className="p-4 space-y-3">
                <Toggle label="Email notifications (UI only)" />
                <Toggle label="WhatsApp alerts (UI only)" />
                <Toggle label="Dark mode (UI only)" />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function inputClass(err?: string) {
  return `h-10 w-full rounded-xl border px-3 text-sm outline-none focus:ring-2 ${
    err ? "border-red-300 focus:ring-red-100" : "border-neutral-200 focus:ring-neutral-200"
  }`;
}

function Field({
  label,
  required,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="text-xs font-medium text-neutral-700 mb-1">
        {label} {required ? <span className="text-red-600">*</span> : null}
      </div>
      {children}
      {error ? <div className="text-xs text-red-600 mt-1">{error}</div> : null}
    </div>
  );
}

function Toggle({ label }: { label: string }) {
  const [on, setOn] = useState(false);
  return (
    <button
      onClick={() => setOn(!on)}
      className="w-full rounded-2xl border border-neutral-200 p-4 flex items-center justify-between hover:bg-neutral-50"
    >
      <div className="text-sm">{label}</div>
      <div className={`h-6 w-11 rounded-full border transition ${on ? "bg-black border-black" : "bg-white border-neutral-300"}`}>
        <div className={`h-5 w-5 rounded-full bg-white shadow-sm transition translate-y-[2px] ${on ? "translate-x-[22px]" : "translate-x-[2px]"}`} />
      </div>
    </button>
  );
}
