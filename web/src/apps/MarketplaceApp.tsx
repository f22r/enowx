import { useCallback, useEffect, useState } from "react";
import { Store, ShieldCheck, Plus, X, Search, RefreshCw, Loader2, Trash2, ImagePlus, ArrowLeft, Tag } from "lucide-react";
import { marketplaceApi, type Listing, type ListingCategory } from "../lib/api";
import { useProfile } from "../os/useProfile";
import { useImageAttach } from "../os/useImageAttach";
import { useDialog } from "../os/dialog";
import { openLightbox } from "../os/lightbox";
import { openProfile } from "../os/profileViewer";

type Kind = "community" | "official";

function idr(amount: number, currency: string) {
  if (currency === "IDR") return "Rp " + amount.toLocaleString("id-ID");
  return currency + " " + amount.toLocaleString();
}

export function MarketplaceApp() {
  const [kind, setKind] = useState<Kind>("community");
  const [detail, setDetail] = useState<Listing | null>(null);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-white/5 px-4 py-2.5">
        <button onClick={() => setKind("official")} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${kind === "official" ? "bg-white/12 text-white" : "text-white/50 hover:bg-white/5"}`}><ShieldCheck className="h-3.5 w-3.5" /> Official Store</button>
        <button onClick={() => setKind("community")} className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium ${kind === "community" ? "bg-white/12 text-white" : "text-white/50 hover:bg-white/5"}`}><Store className="h-3.5 w-3.5" /> Community</button>
        <button onClick={() => setCreating(true)} className="ml-auto flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-black hover:opacity-90"><Plus className="h-3.5 w-3.5" /> Sell</button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {detail ? (
          <ListingDetail listing={detail} onBack={() => setDetail(null)} onDeleted={() => setDetail(null)} />
        ) : (
          <Feed kind={kind} onOpen={setDetail} />
        )}
      </div>
      {creating && <SellModal initialKind={kind} onClose={() => setCreating(false)} onCreated={() => setCreating(false)} />}
    </div>
  );
}

function Feed({ kind, onOpen }: { kind: Kind; onOpen: (l: Listing) => void }) {
  const [items, setItems] = useState<Listing[] | null>(null);
  const [cats, setCats] = useState<ListingCategory[]>([]);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await marketplaceApi.list({ kind, category, q });
      setItems(r?.listings ?? []);
      if (r?.categories) setCats(r.categories);
      setErr("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to load");
      setItems([]);
    }
  }, [kind, category, q]);
  useEffect(() => { setItems(null); load(); }, [load]);

  return (
    <div className="p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-2.5 py-1.5">
          <Search className="h-3.5 w-3.5 text-white/40" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search listings…" className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-xs text-white/80 outline-none">
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        <button onClick={load} className="rounded-lg border border-white/10 p-1.5 text-white/50 hover:bg-white/5 hover:text-white"><RefreshCw className="h-3.5 w-3.5" /></button>
      </div>
      {err && <div className="mb-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</div>}
      {!items ? (
        <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-white/40" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-center text-xs text-white/40">
          {kind === "official" ? "No official products yet." : "No listings yet. Be the first to sell something."}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((l) => <ListingCard key={l.id} l={l} onOpen={() => onOpen(l)} />)}
        </div>
      )}
    </div>
  );
}

function ListingCard({ l, onOpen }: { l: Listing; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.02] text-left hover:border-white/20">
      <div className="aspect-video w-full overflow-hidden bg-white/5">
        {l.images[0] ? (
          <img src={l.images[0]} alt="" className="h-full w-full object-cover transition group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-white/20"><Tag className="h-6 w-6" /></div>
        )}
      </div>
      <div className="p-2.5">
        <div className="truncate text-xs font-medium text-white">{l.title}</div>
        <div className="mt-0.5 text-sm font-semibold text-emerald-300">{idr(l.price_amount, l.currency)}</div>
        <div className="mt-1 truncate text-[10px] text-white/35">by {l.display_name || l.username}</div>
      </div>
    </button>
  );
}

function ListingDetail({ listing, onBack, onDeleted }: { listing: Listing; onBack: () => void; onDeleted: () => void }) {
  const profile = useProfile();
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);
  const mine = !!profile.user?.username && listing.username === profile.user.username;
  const canMod = profile.has("chat.moderate");

  const remove = async () => {
    const ok = await dialog.confirm({ title: "Delete listing?", message: `"${listing.title}" will be removed.`, confirmLabel: "Delete", danger: true });
    if (!ok) return;
    setBusy(true);
    try { await marketplaceApi.remove(listing.id); onDeleted(); } catch { /* ignore */ } finally { setBusy(false); }
  };

  return (
    <div className="p-4">
      <button onClick={onBack} className="mb-3 flex items-center gap-1.5 text-xs text-white/50 hover:text-white"><ArrowLeft className="h-3.5 w-3.5" /> Back</button>
      <div className="mx-auto max-w-2xl">
        {listing.images.length > 0 && (
          <div className="mb-3 grid grid-cols-2 gap-2">
            {listing.images.map((src, i) => (
              <img key={i} src={src} alt="" onClick={() => openLightbox(listing.images, i)} className={`cursor-zoom-in rounded-lg object-cover ${listing.images.length === 1 ? "col-span-2 max-h-80 w-full" : "aspect-video w-full"}`} />
            ))}
          </div>
        )}
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {listing.kind === "official" && <span className="rounded bg-sky-500/20 px-1.5 py-0.5 text-[9px] font-bold uppercase text-sky-300">Official</span>}
              <h1 className="text-lg font-semibold text-white">{listing.title}</h1>
            </div>
            <div className="mt-1 text-xl font-bold text-emerald-300">{idr(listing.price_amount, listing.currency)}</div>
          </div>
          {(mine || canMod) && (
            <button onClick={remove} disabled={busy} className="rounded-lg border border-white/10 bg-white/[0.03] p-1.5 text-white/55 hover:bg-red-500/30 hover:text-red-200 disabled:opacity-40"><Trash2 className="h-4 w-4" /></button>
          )}
        </div>
        <button onClick={() => openProfile(listing.user_id)} className="mt-1.5 text-xs text-white/50 hover:underline">Seller: {listing.display_name || listing.username}</button>
        {listing.warranty && <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/[0.06] px-3 py-2 text-[11px] text-emerald-200/90">Warranty: {listing.warranty}</div>}
        {listing.description && <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-white/70">{listing.description}</p>}
        <div className="mt-4 flex gap-2">
          {listing.kind === "official" ? (
            <button disabled className="flex-1 cursor-not-allowed rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/40">Buy (payment coming soon)</button>
          ) : (
            <button disabled className="flex-1 cursor-not-allowed rounded-lg bg-white/10 px-4 py-2 text-sm font-medium text-white/40">Deal via rekber (coming soon)</button>
          )}
        </div>
      </div>
    </div>
  );
}

function SellModal({ initialKind, onClose, onCreated }: { initialKind: Kind; onClose: () => void; onCreated: () => void }) {
  const profile = useProfile();
  const canOfficial = profile.has("chat.moderate");
  const [kind, setKind] = useState<Kind>(canOfficial ? initialKind : "community");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("other");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");
  const [warranty, setWarranty] = useState("");
  const [stock, setStock] = useState("1");
  const [cats, setCats] = useState<ListingCategory[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const img = useImageAttach();

  useEffect(() => { marketplaceApi.list({ kind: "community" }).then((r) => setCats(r?.categories ?? [])).catch(() => {}); }, []);

  const submit = async () => {
    if (!title.trim()) { setErr("Title required"); return; }
    setSaving(true); setErr("");
    try {
      await marketplaceApi.create({
        kind, category, title: title.trim(), description: description.trim(),
        images: img.images, price_amount: Math.max(0, parseInt(price || "0", 10) || 0),
        currency: "IDR", stock: Math.max(0, parseInt(stock || "1", 10) || 0), warranty: warranty.trim(),
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "failed to create");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex max-h-[90%] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#11131a] shadow-2xl" onClick={(e) => e.stopPropagation()} onPaste={img.onPaste}>
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <div className="flex-1 text-sm font-semibold text-white">New listing</div>
          <button onClick={onClose} className="rounded p-1 text-white/40 hover:bg-white/10 hover:text-white"><X className="h-4 w-4" /></button>
        </div>
        <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
          {canOfficial && (
            <div className="flex gap-1">
              <button onClick={() => setKind("community")} className={`rounded-lg px-2.5 py-1 text-xs ${kind === "community" ? "bg-white/12 text-white" : "text-white/45"}`}>Community</button>
              <button onClick={() => setKind("official")} className={`rounded-lg px-2.5 py-1 text-xs ${kind === "official" ? "bg-white/12 text-white" : "text-white/45"}`}>Official</button>
            </div>
          )}
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
          <div className="flex gap-2">
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="flex-1 rounded-lg border border-white/10 bg-black/30 px-2 py-2 text-sm text-white/80 outline-none">
              {cats.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <div className="flex items-center rounded-lg border border-white/10 bg-black/30 px-2">
              <span className="text-xs text-white/40">Rp</span>
              <input value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} placeholder="0" inputMode="numeric" className="w-24 bg-transparent px-2 py-2 text-sm text-white outline-none" />
            </div>
          </div>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={4} className="w-full resize-none rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
          <div className="flex gap-2">
            <input value={warranty} onChange={(e) => setWarranty(e.target.value)} placeholder="Warranty (optional)" className="flex-1 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
            <input value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} placeholder="Stock" inputMode="numeric" className="w-20 rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white outline-none focus:border-white/25" />
          </div>
          {img.images.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {img.images.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="" className="h-16 w-16 rounded-lg object-cover" />
                  <button onClick={() => img.removeAt(i)} className="absolute -right-1 -top-1 rounded-full bg-black/80 p-0.5 text-white/70 hover:text-white"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          <label className="flex w-fit cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-white/60 hover:bg-white/10">
            <ImagePlus className="h-3.5 w-3.5" /> {img.uploading ? "Uploading…" : `Add images (${img.images.length}/${img.max})`}
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => img.upload(e.target.files)} />
          </label>
          {err && <div className="text-xs text-red-300">{err}</div>}
        </div>
        <div className="flex justify-end gap-2 border-t border-white/5 px-4 py-3">
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-xs text-white/50 hover:text-white">Cancel</button>
          <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 rounded-lg bg-white px-4 py-1.5 text-xs font-medium text-black hover:opacity-90 disabled:opacity-50">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Publish
          </button>
        </div>
      </div>
    </div>
  );
}
