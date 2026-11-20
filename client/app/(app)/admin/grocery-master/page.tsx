"use client";

import { useDeferredValue, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, Search, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pagination } from "@/components/shared/pagination";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { adminApi } from "@/lib/api/endpoints";
import type { AdminGroceryMasterItem, Unit } from "@/lib/api/types";
import { formatDate, formatPoisha } from "@/lib/format";
import { useMe } from "@/lib/hooks/queries";

const UNITS: Unit[] = ["KG", "GRAM", "LITRE", "ML", "PIECE", "DOZEN", "PACKET", "BOTTLE"];

export default function GroceryMasterAdminPage() {
  const profile = useMe();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search.trim());
  const [page, setPage] = useState(1);

  const items = useQuery({
    queryKey: ["admin", "grocery-master", deferredSearch, page],
    queryFn: () => adminApi.groceryMaster({ q: deferredSearch || undefined, page, pageSize: 20 }),
    enabled: profile.data?.platformRole === "ADMIN",
  });

  const deletePrice = useMutation({
    mutationFn: (itemId: string) => adminApi.deleteGroceryMasterPrice(itemId),
    onSuccess: async () => {
      toast.success("Shared reference price deleted");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "grocery-master"] }),
        queryClient.invalidateQueries({ queryKey: ["grocery-items"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete reference price"),
  });

  const deleteItem = useMutation({
    mutationFn: (itemId: string) => adminApi.deleteGroceryMasterItem(itemId),
    onSuccess: async (result) => {
      toast.success(result.deactivated ? "Item deactivated to preserve bazar history" : "Shared item deleted");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "grocery-master"] }),
        queryClient.invalidateQueries({ queryKey: ["grocery-items"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete shared item"),
  });

  if (profile.isPending) return <main className="mx-auto max-w-7xl p-6 text-sm text-muted-foreground">Loading…</main>;
  if (profile.data?.platformRole !== "ADMIN") {
    return (
      <main className="mx-auto max-w-3xl space-y-3 p-6">
        <h1 className="text-xl font-semibold">No access</h1>
        <p className="text-sm text-muted-foreground">A platform administrator account is required to manage shared grocery data.</p>
        <Button asChild variant="outline"><Link href="/admin">Back to administration</Link></Button>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-7xl space-y-5 px-3 py-6 sm:px-6">
      <Button asChild variant="ghost" size="sm">
        <Link href="/admin"><ArrowLeft /> Platform administration</Link>
      </Button>
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Shared grocery master</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the imported 2026-11-20 Bangladesh item list and its source-backed reference price ranges.
          These are estimates/listings, not verified shop purchases.
        </p>
      </div>

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Grocery items and reference prices</CardTitle>
            <CardDescription>Editing these shared records updates the reference data for every mess.</CardDescription>
          </div>
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search name, category or source ID"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4 px-0 pb-0">
          {items.isPending ? (
            <p className="px-5 py-8 text-sm text-muted-foreground">Loading shared grocery data…</p>
          ) : items.isError ? (
            <p className="px-5 py-8 text-sm text-destructive">{items.error.message}</p>
          ) : (items.data?.items.length ?? 0) === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">No shared grocery items found.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item / source ID</TableHead>
                      <TableHead>Category and unit</TableHead>
                      <TableHead>Reference range</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.data?.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          <span className="flex flex-col">
                            <span className="font-medium">{item.nameEn} · {item.nameBn}</span>
                            <span className="text-xs text-muted-foreground">{item.sourceItemId ?? "No source ID"}</span>
                          </span>
                        </TableCell>
                        <TableCell>{item.category} · {item.masterPrice?.unitLabel ?? item.unit}</TableCell>
                        <TableCell>
                          {item.masterPrice ? (
                            <span className="flex flex-col">
                              <span>{formatPoisha(item.masterPrice.minPricePoisha)}–{formatPoisha(item.masterPrice.maxPricePoisha)}</span>
                              <span className="text-xs text-muted-foreground">
                                Reference {formatPoisha(item.masterPrice.referencePricePoisha)} / {item.masterPrice.unitLabel}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {item.masterPrice.priceType} · {formatDate(item.masterPrice.checkedOn)}
                              </span>
                            </span>
                          ) : <span className="text-muted-foreground">No reference price</span>}
                        </TableCell>
                        <TableCell className="max-w-56">
                          {item.masterPrice ? (
                            <a href={item.masterPrice.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-primary underline-offset-4 hover:underline" title={item.masterPrice.sourceNote}>
                              {item.masterPrice.sourceNote}
                            </a>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          {item.isActive && item.masterPrice?.isActive ? "Active" : "Inactive"}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <MasterItemDialog item={item} />
                            {item.masterPrice ? (
                              <ConfirmDialog
                                trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete reference price"><Trash2 /></Button>}
                                title="Delete this shared reference price?"
                                description="The grocery item remains in the shared catalogue. This removes its CSV-backed price, source and notes for all messes."
                                confirmLabel="Delete price"
                                variant="destructive"
                                pending={deletePrice.isPending}
                                onConfirm={() => deletePrice.mutate(item.id)}
                              />
                            ) : null}
                            <ConfirmDialog
                              trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete shared item"><Trash2 /></Button>}
                              title="Delete this shared grocery item?"
                              description="If bazar history already uses it, the item and reference price will be deactivated instead of removed."
                              confirmLabel="Delete item"
                              variant="destructive"
                              pending={deleteItem.isPending}
                              onConfirm={() => deleteItem.mutate(item.id)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="px-5 pb-4">
                <Pagination meta={items.data?.meta} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}

function MasterItemDialog({ item }: { item: AdminGroceryMasterItem }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState(item.nameEn);
  const [nameBn, setNameBn] = useState(item.nameBn);
  const [category, setCategory] = useState(item.category);
  const [unit, setUnit] = useState<Unit>(item.unit);
  const [itemActive, setItemActive] = useState(item.isActive);
  const [unitLabel, setUnitLabel] = useState(item.masterPrice?.unitLabel ?? item.unit);
  const [minPriceTaka, setMinPriceTaka] = useState(toTaka(item.masterPrice?.minPricePoisha));
  const [maxPriceTaka, setMaxPriceTaka] = useState(toTaka(item.masterPrice?.maxPricePoisha));
  const [referencePriceTaka, setReferencePriceTaka] = useState(toTaka(item.masterPrice?.referencePricePoisha));
  const [sourceNote, setSourceNote] = useState(item.masterPrice?.sourceNote ?? "");
  const [sourceUrl, setSourceUrl] = useState(item.masterPrice?.sourceUrl ?? "");
  const [checkedOn, setCheckedOn] = useState(item.masterPrice?.checkedOn ?? "");
  const [priceType, setPriceType] = useState(item.masterPrice?.priceType ?? "Observed/listed");
  const [priceActive, setPriceActive] = useState(item.masterPrice?.isActive ?? true);
  const [notes, setNotes] = useState(item.masterPrice?.notes ?? "");

  const update = useMutation({
    mutationFn: () => adminApi.updateGroceryMasterItem(item.id, {
      nameEn: nameEn.trim(),
      nameBn: nameBn.trim(),
      category: category.trim(),
      unit,
      isActive: itemActive,
      ...(item.masterPrice ? {
        unitLabel: unitLabel.trim(),
        minPriceTaka,
        maxPriceTaka,
        referencePriceTaka,
        sourceNote: sourceNote.trim(),
        sourceUrl: sourceUrl.trim(),
        checkedOn,
        priceType: priceType.trim(),
        priceIsActive: priceActive,
        notes,
      } : {}),
    }),
    onSuccess: async () => {
      toast.success("Shared grocery data updated");
      setOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin", "grocery-master"] }),
        queryClient.invalidateQueries({ queryKey: ["grocery-items"] }),
      ]);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update shared grocery data"),
  });

  const valid =
    nameEn.trim() &&
    nameBn.trim() &&
    category.trim() &&
    (!item.masterPrice ||
      (unitLabel.trim() &&
        sourceNote.trim() &&
        sourceUrl.trim() &&
        checkedOn &&
        Number(minPriceTaka) <= Number(referencePriceTaka) &&
        Number(referencePriceTaka) <= Number(maxPriceTaka)));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="outline" aria-label="Edit shared grocery item"><Pencil /></Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit shared grocery data</DialogTitle>
          <DialogDescription>Changes here apply to the shared list used by all messes.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="English name" value={nameEn} onChange={setNameEn} />
          <Field label="Bangla name" value={nameBn} onChange={setNameBn} />
          <Field label="Category" value={category} onChange={setCategory} />
          <div className="space-y-2">
            <Label>Operational unit</Label>
            <Select value={unit} onValueChange={(value) => setUnit(value as Unit)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNITS.map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Field label="Source unit label" value={unitLabel} onChange={setUnitLabel} />
          <Field label="Price type" value={priceType} onChange={setPriceType} />
          <Field label="Minimum price (৳)" value={minPriceTaka} onChange={setMinPriceTaka} type="number" />
          <Field label="Maximum price (৳)" value={maxPriceTaka} onChange={setMaxPriceTaka} type="number" />
          <Field label="Reference price (৳)" value={referencePriceTaka} onChange={setReferencePriceTaka} type="number" />
          <Field label="Checked on" value={checkedOn} onChange={setCheckedOn} type="date" />
          <Field label="Source note" value={sourceNote} onChange={setSourceNote} />
          <Field label="Source URL" value={sourceUrl} onChange={setSourceUrl} type="url" />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={itemActive} onChange={(event) => setItemActive(event.target.checked)} />
            Item active
          </label>
          {item.masterPrice ? (
            <>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={priceActive} onChange={(event) => setPriceActive(event.target.checked)} />
                Reference price active
              </label>
              <div className="sm:col-span-2">
                <Field label="Notes" value={notes} onChange={setNotes} />
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={update.isPending}>Cancel</Button>
          <Button loading={update.isPending} disabled={!valid} onClick={() => update.mutate()}>Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}

function toTaka(poisha?: string): string {
  return poisha ? (Number(poisha) / 100).toFixed(2) : "";
}
