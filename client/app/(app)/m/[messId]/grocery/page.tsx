"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Carrot, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { Money } from "@/components/shared/money";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { aiApi, groceryApi } from "@/lib/api/endpoints";
import type { GroceryItem, GroceryPrice, PriceSource, Unit } from "@/lib/api/types";
import { formatDate, humanize, todayInDhaka } from "@/lib/format";
import { useMyMembership } from "@/lib/hooks/use-my-membership";
import { qk } from "@/lib/hooks/queries";

const UNITS: Unit[] = ["KG", "GRAM", "LITRE", "ML", "PIECE", "DOZEN", "PACKET", "BOTTLE"];

export default function GroceryPage() {
  const { messId } = useParams<{ messId: string }>();
  const { isManager } = useMyMembership(messId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Grocery & prices"
        description="The item catalogue and the price history used when recording bazar. Prices are never invented — every price has a source."
      />
      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Catalogue</TabsTrigger>
          <TabsTrigger value="prices">Prices</TabsTrigger>
        </TabsList>
        <TabsContent value="items">
          <CatalogueTab messId={messId} isManager={Boolean(isManager)} />
        </TabsContent>
        <TabsContent value="prices">
          <PricesTab messId={messId} isManager={Boolean(isManager)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Catalogue                                                                  */
/* -------------------------------------------------------------------------- */

function CatalogueTab({ messId, isManager }: { messId: string; isManager: boolean }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [page, setPage] = useState(1);

  const filters = { search, includeInactive, page };
  const items = useQuery({
    queryKey: qk.groceryItems(messId, filters),
    queryFn: () => groceryApi.listItems(messId, { search: search || undefined, includeInactive, page, pageSize: 12 }),
  });

  const remove = useMutation({
    mutationFn: (itemId: string) => groceryApi.deleteItem(messId, itemId),
    onSuccess: () => {
      toast.success("Item deleted");
      void queryClient.invalidateQueries({ queryKey: ["grocery-items", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete the item"),
  });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle>Catalogue</CardTitle>
          <CardDescription>Shared items come from the built-in list; custom items belong to this mess.</CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="include-inactive" checked={includeInactive} onCheckedChange={(value) => { setIncludeInactive(value); setPage(1); }} />
            <Label htmlFor="include-inactive">Show inactive</Label>
          </div>
          <Input
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(1); }}
            placeholder="Search items"
            className="w-48"
          />
          {isManager ? <ItemDialog messId={messId} /> : null}
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {items.isPending ? (
          <div className="px-5">
            <TableSkeleton columns={6} rows={6} />
          </div>
        ) : items.isError ? (
          <div className="px-5">
            <ErrorState error={items.error} onRetry={() => void items.refetch()} compact />
          </div>
        ) : (items.data?.items ?? []).length === 0 ? (
          <div className="px-5">
            <EmptyState icon={Carrot} title="No items found" description="Try a different search, or add a custom item." />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-right">Latest / reference price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(items.data?.items ?? []).map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-medium">{item.nameEn}</span>
                        <span className="text-xs text-muted-foreground">{item.nameBn}</span>
                      </span>
                    </TableCell>
                    <TableCell>{item.category}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell className="text-right">
                      <span className="flex flex-col items-end gap-1">
                        {item.latestPricePoisha ? (
                          <span className="flex flex-col items-end">
                            <Money value={item.latestPricePoisha} />
                            <span className="text-xs text-muted-foreground">
                              Mess observation{item.latestPriceSource ? ` · ${humanize(item.latestPriceSource)}` : ""}
                              {item.latestPriceObservedOn ? ` · ${formatDate(item.latestPriceObservedOn)}` : ""}
                            </span>
                          </span>
                        ) : null}
                        {item.masterPrice?.isActive ? (
                          <span className="flex max-w-xs flex-col items-end text-xs">
                            <span className="font-medium">
                              Reference: <Money value={item.masterPrice.minPricePoisha} />–<Money value={item.masterPrice.maxPricePoisha} />
                              {" "}/ {item.masterPrice.unitLabel}
                            </span>
                            <span className="text-muted-foreground">
                              Typical reference <Money value={item.masterPrice.referencePricePoisha} />
                            </span>
                            <span className="text-muted-foreground">
                              {item.masterPrice.priceType} · checked {formatDate(item.masterPrice.checkedOn)}
                            </span>
                            <a
                              href={item.masterPrice.sourceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="max-w-full truncate text-primary underline-offset-4 hover:underline"
                              title={item.masterPrice.sourceNote}
                            >
                              {item.masterPrice.sourceNote}
                            </a>
                          </span>
                        ) : null}
                        {!item.latestPricePoisha && !item.masterPrice?.isActive ? (
                          <span className="text-muted-foreground">—</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1">
                        {item.isActive ? <Badge variant="muted">Active</Badge> : <Badge variant="outline">Inactive</Badge>}
                        {item.isCustom ? <Badge variant="secondary">Custom</Badge> : null}
                      </span>
                    </TableCell>
                    <TableCell>
                      {isManager && item.isCustom ? (
                        <div className="flex justify-end">
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Delete item"
                            loading={remove.isPending && remove.variables === item.id}
                            onClick={() => remove.mutate(item.id)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-5 pb-4">
              <Pagination meta={items.data?.meta} onPageChange={setPage} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function ItemDialog({ messId }: { messId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState<Unit>("KG");
  const [aliases, setAliases] = useState("");

  const create = useMutation({
    mutationFn: () =>
      groceryApi.createItem(messId, {
        nameEn: nameEn.trim(),
        nameBn: nameBn.trim(),
        category: category.trim(),
        unit,
        aliases: aliases
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean),
      }),
    onSuccess: () => {
      toast.success("Item added to the catalogue");
      void queryClient.invalidateQueries({ queryKey: ["grocery-items", messId] });
      setOpen(false);
      setNameEn("");
      setNameBn("");
      setCategory("");
      setAliases("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not add the item"),
  });

  const valid = nameEn.trim() && nameBn.trim() && category.trim();

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          Add item
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add a custom item</DialogTitle>
          <DialogDescription>Custom items are visible only to this mess.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item-en">English name</Label>
              <Input id="item-en" value={nameEn} onChange={(event) => setNameEn(event.target.value)} placeholder="Beef" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="item-bn">Bangla name</Label>
              <Input id="item-bn" value={nameBn} onChange={(event) => setNameBn(event.target.value)} placeholder="গরুর মাংস" />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="item-category">Category</Label>
              <Input id="item-category" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Meat" />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(value) => setUnit(value as Unit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="item-aliases">Aliases (comma separated, optional)</Label>
            <Input id="item-aliases" value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="gorur mangsho, beef" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={!valid} onClick={() => create.mutate()}>
            Add item
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Prices                                                                     */
/* -------------------------------------------------------------------------- */

function PricesTab({ messId, isManager }: { messId: string; isManager: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [verification, setVerification] = useState("all");

  const filters = { verification, page };
  const prices = useQuery({
    queryKey: qk.groceryPrices(messId, filters),
    queryFn: () =>
      groceryApi.listPrices(messId, {
        verification: verification === "all" ? undefined : verification,
        page,
        pageSize: 12,
      }),
  });

  const setVerificationState = useMutation({
    mutationFn: ({ priceId, value }: { priceId: string; value: string }) =>
      groceryApi.updatePrice(messId, priceId, { verification: value }),
    onSuccess: () => {
      toast.success("Price updated");
      void queryClient.invalidateQueries({ queryKey: ["grocery-prices", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not update the price"),
  });

  const remove = useMutation({
    mutationFn: (priceId: string) => groceryApi.deletePrice(messId, priceId),
    onSuccess: () => {
      toast.success("Price deleted");
      void queryClient.invalidateQueries({ queryKey: ["grocery-prices", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete the price"),
  });

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
        <div>
          <CardTitle>Price history</CardTitle>
          <CardDescription>
            Mess observations are separate from the shared CSV reference range. Managers can edit, verify, or delete observations.
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={verification} onValueChange={(value) => { setVerification(value); setPage(1); }}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All prices</SelectItem>
              <SelectItem value="UNVERIFIED">Unverified</SelectItem>
              <SelectItem value="VERIFIED">Verified</SelectItem>
              <SelectItem value="OUTDATED">Outdated</SelectItem>
            </SelectContent>
          </Select>
          <PriceDialog messId={messId} />
        </div>
      </CardHeader>
      <CardContent className="px-0 pb-0">
        {prices.isPending ? (
          <div className="px-5">
            <TableSkeleton columns={7} rows={6} />
          </div>
        ) : prices.isError ? (
          <div className="px-5">
            <ErrorState error={prices.error} onRetry={() => void prices.refetch()} compact />
          </div>
        ) : (prices.data?.items ?? []).length === 0 ? (
          <div className="px-5">
            <EmptyState
              icon={Carrot}
              title="No prices recorded"
              description="Add a price you have seen so bazar entries can be filled in faster."
            />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Observed</TableHead>
                  <TableHead>Verification</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(prices.data?.items ?? []).map((price) => (
                  <TableRow key={price.id}>
                    <TableCell>
                      <span className="flex flex-col">
                        <span className="font-medium">{price.itemNameEn ?? "Item"}</span>
                        {price.itemNameBn ? <span className="text-xs text-muted-foreground">{price.itemNameBn}</span> : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Money value={price.pricePoisha} />
                    </TableCell>
                    <TableCell>{price.unit}</TableCell>
                    <TableCell>
                      <span className="flex flex-col">
                        <span>{humanize(price.source)}</span>
                        {price.shopName ? <span className="text-xs text-muted-foreground">{price.shopName}</span> : null}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap">{formatDate(price.observedOn)}</TableCell>
                    <TableCell>
                      <StatusBadge status={price.verification} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-end gap-1">
                        {isManager && price.verification !== "VERIFIED" ? (
                          <Button
                            size="icon-sm"
                            variant="outline"
                            aria-label="Verify price"
                            loading={setVerificationState.isPending && setVerificationState.variables?.priceId === price.id}
                            onClick={() => setVerificationState.mutate({ priceId: price.id, value: "VERIFIED" })}
                          >
                            <BadgeCheck />
                          </Button>
                        ) : null}
                        {isManager ? (
                          <>
                            <PriceDialog messId={messId} price={price} />
                            <ConfirmDialog
                              trigger={<Button size="icon-sm" variant="ghost" aria-label="Delete price"><Trash2 /></Button>}
                              title="Delete this mess price observation?"
                              description="This removes the selected price record from this mess. It does not affect the shared reference range or bazar history."
                              confirmLabel="Delete price"
                              variant="destructive"
                              pending={remove.isPending && remove.variables === price.id}
                              onConfirm={() => remove.mutate(price.id)}
                            />
                          </>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="px-5 pb-4">
              <Pagination meta={prices.data?.meta} onPageChange={setPage} />
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function PriceDialog({ messId, price }: { messId: string; price?: GroceryPrice }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [groceryItemId, setGroceryItemId] = useState(price?.groceryItemId ?? "");
  const [priceTaka, setPriceTaka] = useState(price?.priceTaka ?? "");
  const [unit, setUnit] = useState<Unit>(price?.unit ?? "KG");
  const [source, setSource] = useState<PriceSource>(price?.source ?? "MANAGER_ENTRY");
  const [shopName, setShopName] = useState(price?.shopName ?? "");
  const [location, setLocation] = useState(price?.location ?? "");
  const [observedOn, setObservedOn] = useState(price?.observedOn ?? todayInDhaka());
  const [estimate, setEstimate] = useState<{ priceTaka: number; confidence: number; rationale?: string } | null>(null);

  const items = useQuery({
    queryKey: qk.groceryItems(messId, { picker: true }),
    queryFn: () => groceryApi.listItems(messId, { pageSize: 100 }),
    enabled: open,
  });

  const selectedItem: GroceryItem | undefined = (items.data?.items ?? []).find((item) => item.id === groceryItemId);

  const estimateMutation = useMutation({
    mutationFn: () =>
      aiApi.priceEstimate(messId, {
        groceryItemId: groceryItemId || undefined,
        nameEn: groceryItemId ? undefined : undefined,
        unit,
      }),
    onSuccess: (result) => {
      if (result.status === "SUCCEEDED" && result.data) {
        setEstimate(result.data);
        toast.success("AI suggested a price — review it before saving");
      } else {
        toast.error(result.errorMessage ?? "AI could not estimate a price right now");
      }
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "AI request failed"),
  });

  const create = useMutation({
    mutationFn: () => {
      const body = {
        priceTaka,
        unit,
        shopName: shopName.trim() || null,
        location: location.trim() || null,
        observedOn,
      };
      return price
        ? groceryApi.updatePrice(messId, price.id, body)
        : groceryApi.createPrice(messId, { ...body, groceryItemId, source });
    },
    onSuccess: () => {
      toast.success(price ? "Price updated" : "Price saved");
      void queryClient.invalidateQueries({ queryKey: ["grocery-prices", messId] });
      void queryClient.invalidateQueries({ queryKey: ["grocery-items", messId] });
      setOpen(false);
      if (!price) {
        setPriceTaka("");
        setShopName("");
        setLocation("");
      }
      setEstimate(null);
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save the price"),
  });

  const valid = groceryItemId && priceTaka.trim() !== "";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setEstimate(null);
          if (price) {
            setPriceTaka(price.priceTaka);
            setShopName(price.shopName ?? "");
            setLocation(price.location ?? "");
            setObservedOn(price.observedOn);
            setUnit(price.unit);
          } else {
            setPriceTaka("");
            setShopName("");
            setLocation("");
          }
        }
      }}
    >
      <DialogTrigger asChild>
        {price ? (
          <Button size="icon-sm" variant="outline" aria-label="Edit price">
            <Pencil />
          </Button>
        ) : (
          <Button>
            <Plus />
            Add price
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{price ? "Edit price observation" : "Record a price"}</DialogTitle>
          <DialogDescription>
            {price ? "Update this mess price observation." : "A price you observed in a shop. It starts as unverified."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Item</Label>
            <Select value={groceryItemId} onValueChange={setGroceryItemId} disabled={Boolean(price)}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an item" />
              </SelectTrigger>
              <SelectContent>
                {(items.data?.items ?? []).map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    {item.nameEn} · {item.nameBn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price-taka">Price (৳)</Label>
              <Input
                id="price-taka"
                inputMode="decimal"
                value={priceTaka}
                onChange={(event) => setPriceTaka(event.target.value)}
                placeholder="120"
              />
            </div>
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(value) => setUnit(value as Unit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {UNITS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedItem ? (
            <div className="rounded-lg border bg-muted/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="flex items-center gap-1.5 text-sm font-medium">
                  <Sparkles className="size-4 text-primary" />
                  AI price estimate
                </p>
                <Button size="sm" variant="outline" loading={estimateMutation.isPending} onClick={() => estimateMutation.mutate()}>
                  Estimate
                </Button>
              </div>
              {estimate ? (
                <div className="mt-2 space-y-1 text-sm">
                  <p>
                    Suggested: <span className="font-medium">৳{estimate.priceTaka.toFixed(2)}</span>{" "}
                    <span className="text-xs text-muted-foreground">({Math.round(estimate.confidence * 100)}% confidence)</span>
                  </p>
                  {estimate.rationale ? <p className="text-xs text-muted-foreground">{estimate.rationale}</p> : null}
                  <Button size="sm" variant="secondary" onClick={() => setPriceTaka(estimate.priceTaka.toFixed(2))}>
                    Use this price
                  </Button>
                  <p className="text-xs text-muted-foreground">AI suggestions are never saved automatically.</p>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">Ask the AI for a reference price range, then confirm it yourself.</p>
              )}
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Source</Label>
            <Select value={source} onValueChange={(value) => setSource(value as PriceSource)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="MANAGER_ENTRY">Shop observation</SelectItem>
                <SelectItem value="RETAILER_FEED">Retailer feed</SelectItem>
                <SelectItem value="ADMIN_REFERENCE">Admin reference</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="price-shop">Shop (optional)</Label>
              <Input id="price-shop" value={shopName} onChange={(event) => setShopName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="price-location">Location (optional)</Label>
              <Input id="price-location" value={location} onChange={(event) => setLocation(event.target.value)} />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="price-date">Observed on</Label>
            <Input id="price-date" type="date" value={observedOn} onChange={(event) => setObservedOn(event.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={!valid} onClick={() => create.mutate()}>
            {price ? "Update price" : "Save price"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
