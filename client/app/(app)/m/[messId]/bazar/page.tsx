"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Images, Plus, Send, ShoppingBasket, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ImageUpload } from "@/components/shared/image-upload";
import { Money } from "@/components/shared/money";
import { NoMonthState } from "@/components/shared/no-month";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { TableSkeleton } from "@/components/shared/skeletons";
import { StatusBadge } from "@/components/shared/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LoadingAnimation } from "@/components/ui/lottie-animation";
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
import { Textarea } from "@/components/ui/textarea";
import { bazarApi, groceryApi, mediaApi, type BazarItemPayload } from "@/lib/api/endpoints";
import type { BazarStatus, MediaAsset, PaymentMethod, Unit } from "@/lib/api/types";
import { useActiveMonth } from "@/lib/context/active-month";
import { formatDate, humanize, todayInDhaka } from "@/lib/format";
import { useMyMembership } from "@/lib/hooks/use-my-membership";
import { qk } from "@/lib/hooks/queries";

const STATUSES: BazarStatus[] = ["DRAFT", "PENDING_REVIEW", "APPROVED", "REJECTED"];
const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "BKASH", "NAGAD", "ROCKET", "BANK", "OTHER"];
const UNITS: Unit[] = ["KG", "GRAM", "LITRE", "ML", "PIECE", "DOZEN", "PACKET", "BOTTLE"];

export default function BazarPage() {
  const { messId } = useParams<{ messId: string }>();
  const { activeMonth } = useActiveMonth();
  const monthId = activeMonth?.id ?? null;
  const { isManager, isPending: memberPending } = useMyMembership(messId);

  const [status, setStatus] = useState<string>("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [page, setPage] = useState(1);

  const filters = { monthId, status, mine: mineOnly, page };
  const entries = useQuery({
    queryKey: qk.bazar(messId, filters),
    queryFn: () =>
      bazarApi.list(messId, {
        monthId: monthId as string,
        status: status === "all" ? undefined : status,
        mine: mineOnly || undefined,
        page,
        pageSize: 10,
      }),
    enabled: Boolean(monthId),
  });

  if (activeMonth === null) {
    return (
      <div className="space-y-6">
        <PageHeader title="Bazar" description="Bazar purchases belong to the current month." />
        {memberPending ? <TableSkeleton columns={5} rows={4} /> : <NoMonthState messId={messId} isManager={Boolean(isManager)} what="Bazar" />}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Bazar"
        description={`Shopping entries for ${activeMonth.label}. An approved entry becomes a meal-bazar expense automatically.`}
        actions={
          <BazarEntryDialog messId={messId} monthId={monthId as string} />
        }
      />

      <Card>
        <CardHeader className="flex-row flex-wrap items-end justify-between gap-3">
          <div>
            <CardTitle>Entries</CardTitle>
            <CardDescription>Each entry records what was bought, by whom, and for how much.</CardDescription>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch id="mine" checked={mineOnly} onCheckedChange={(value) => { setMineOnly(value); setPage(1); }} />
              <Label htmlFor="mine">Only mine</Label>
            </div>
            <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {STATUSES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {humanize(item)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {entries.isPending ? (
            <div className="px-5">
              <TableSkeleton columns={6} rows={6} />
            </div>
          ) : entries.isError ? (
            <div className="px-5">
              <ErrorState error={entries.error} onRetry={() => void entries.refetch()} compact />
            </div>
          ) : (entries.data?.items ?? []).length === 0 ? (
            <div className="px-5">
              <EmptyState
                icon={ShoppingBasket}
                title="No bazar entries"
                description="Record your shopping trip; add each item with its quantity and price."
              />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Shop</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(entries.data?.items ?? []).map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="whitespace-nowrap">{formatDate(entry.purchaseDate)}</TableCell>
                      <TableCell>{entry.shopName ?? "—"}</TableCell>
                      <TableCell>{entry.buyerName ?? "—"}</TableCell>
                      <TableCell className="tabular text-right">{entry.itemCount}</TableCell>
                      <TableCell className="text-right">
                        <Money value={entry.totalPoisha} />
                      </TableCell>
                      <TableCell>
                        <span className="flex flex-col gap-1">
                          <StatusBadge status={entry.status} />
                          {entry.expenseId ? <Badge variant="muted">Posted</Badge> : null}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <PhotosButton messId={messId} entryId={entry.id} />
                          {entry.status === "DRAFT" ? <SubmitButton messId={messId} entryId={entry.id} /> : null}
                          {isManager && entry.status === "PENDING_REVIEW" ? (
                            <>
                              <ApproveButton messId={messId} entryId={entry.id} />
                              <RejectButton messId={messId} entryId={entry.id} />
                            </>
                          ) : null}
                          {entry.status === "DRAFT" || entry.status === "REJECTED" ? (
                            <DeleteButton messId={messId} entryId={entry.id} />
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="px-5 pb-4">
                <Pagination meta={entries.data?.meta} onPageChange={setPage} />
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Looking for prices? See <Link href={`/m/${messId}/grocery`} className="text-primary underline-offset-4 hover:underline">Grocery &amp; prices</Link>.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Action buttons                                                             */
/* -------------------------------------------------------------------------- */

function SubmitButton({ messId, entryId }: { messId: string; entryId: string }) {
  const queryClient = useQueryClient();
  const submit = useMutation({
    mutationFn: () => bazarApi.submit(messId, entryId),
    onSuccess: () => {
      toast.success("Entry submitted for review");
      void queryClient.invalidateQueries({ queryKey: ["bazar", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not submit"),
  });
  return (
    <Button size="icon-sm" variant="outline" aria-label="Submit for review" loading={submit.isPending} onClick={() => submit.mutate()}>
      <Send />
    </Button>
  );
}

function ApproveButton({ messId, entryId }: { messId: string; entryId: string }) {
  const queryClient = useQueryClient();
  const approve = useMutation({
    mutationFn: () => bazarApi.approve(messId, entryId),
    onSuccess: () => {
      toast.success("Entry approved and posted as an expense");
      void queryClient.invalidateQueries({ queryKey: ["bazar", messId] });
      void queryClient.invalidateQueries({ queryKey: ["expenses", messId] });
      void queryClient.invalidateQueries({ queryKey: ["reports", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not approve"),
  });
  return (
    <Button size="icon-sm" variant="outline" aria-label="Approve" loading={approve.isPending} onClick={() => approve.mutate()}>
      <Check />
    </Button>
  );
}

function RejectButton({ messId, entryId }: { messId: string; entryId: string }) {
  const queryClient = useQueryClient();
  const reject = useMutation({
    mutationFn: (reason: string) => bazarApi.reject(messId, entryId, reason),
    onSuccess: () => {
      toast.success("Entry rejected");
      void queryClient.invalidateQueries({ queryKey: ["bazar", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not reject"),
  });
  return (
    <ConfirmDialog
      trigger={
        <Button size="icon-sm" variant="outline" aria-label="Reject">
          <X />
        </Button>
      }
      title="Reject this bazar entry?"
      description="The buyer will need to correct and resubmit it. A reason is stored in the audit log."
      confirmLabel="Reject"
      variant="destructive"
      requireReason
      reasonLabel="Reason"
      pending={reject.isPending}
      onConfirm={(reason) => reject.mutate(reason)}
    />
  );
}

function DeleteButton({ messId, entryId }: { messId: string; entryId: string }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: () => bazarApi.remove(messId, entryId),
    onSuccess: () => {
      toast.success("Entry deleted");
      void queryClient.invalidateQueries({ queryKey: ["bazar", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete"),
  });
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label="Delete"
      loading={remove.isPending}
      onClick={() => remove.mutate()}
    >
      <Trash2 />
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Create entry dialog                                                        */
/* -------------------------------------------------------------------------- */

interface ItemRow {
  key: string;
  groceryItemId: string | null;
  nameSnapshot: string;
  unit: Unit;
  quantity: string;
  /** Total price (in Taka) the buyer paid for this line item — entered manually, not auto-computed. */
  totalPriceTaka: string;
}

function emptyRow(): ItemRow {
  return { key: Math.random().toString(36).slice(2), groceryItemId: null, nameSnapshot: "", unit: "KG", quantity: "1", totalPriceTaka: "" };
}

function BazarEntryDialog({ messId, monthId }: { messId: string; monthId: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState(todayInDhaka());
  const [shopName, setShopName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [notes, setNotes] = useState("");
  const [submitNow, setSubmitNow] = useState(true);
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);

  const items = useQuery({
    queryKey: qk.groceryItems(messId, { picker: true }),
    queryFn: () => groceryApi.listItems(messId, { pageSize: 100 }),
    enabled: open,
  });

  const estimatedTotal = rows.reduce((sum, row) => {
    const price = Number(row.totalPriceTaka);
    if (!Number.isFinite(price)) return sum;
    return sum + price;
  }, 0);

  const create = useMutation({
    mutationFn: () => {
      const payload: BazarItemPayload[] = rows
        .filter((row) => row.groceryItemId || row.nameSnapshot.trim())
        .map((row) => ({
          groceryItemId: row.groceryItemId ?? undefined,
          nameSnapshot: row.groceryItemId ? undefined : row.nameSnapshot.trim(),
          unit: row.unit,
          quantity: row.quantity,
          totalPriceTaka: row.totalPriceTaka,
        }));
      return bazarApi.create(messId, {
        monthId,
        purchaseDate,
        shopName: shopName.trim() || null,
        paymentMethod,
        notes: notes.trim() || null,
        items: payload,
        submit: submitNow,
      });
    },
    onSuccess: () => {
      toast.success(submitNow ? "Entry submitted for review" : "Draft saved");
      void queryClient.invalidateQueries({ queryKey: ["bazar", messId] });
      setOpen(false);
      setRows([emptyRow()]);
      setShopName("");
      setNotes("");
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not save the entry"),
  });

  const validRows = rows.filter((row) => (row.groceryItemId || row.nameSnapshot.trim()) && row.totalPriceTaka.trim());
  const canSubmit = validRows.length > 0 && !create.isPending;

  const update = (key: string, patch: Partial<ItemRow>) =>
    setRows((prev) => prev.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setRows([emptyRow()]);
          setShopName("");
          setNotes("");
        }
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Plus />
          New bazar entry
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Record a bazar purchase</DialogTitle>
          <DialogDescription>
            Add each item with its unit and price. Saving as a draft lets you finish later.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="purchase-date">Date</Label>
              <Input id="purchase-date" type="date" value={purchaseDate} onChange={(event) => setPurchaseDate(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="shop-name">Shop (optional)</Label>
              <Input id="shop-name" value={shopName} onChange={(event) => setShopName(event.target.value)} placeholder="Karwan Bazar" />
            </div>
            <div className="space-y-2">
              <Label>Paid by</Label>
              <Select value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PaymentMethod)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {humanize(method)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Items</Label>
              <Button size="sm" variant="outline" onClick={() => setRows((prev) => [...prev, emptyRow()])}>
                <Plus />
                Add row
              </Button>
            </div>
            <div className="space-y-2">
              {rows.map((row) => (
                <div key={row.key} className="grid grid-cols-12 gap-2">
                  <div className="col-span-12 sm:col-span-4">
                    <Select
                      value={row.groceryItemId ?? "__other"}
                      onValueChange={(value) =>
                        update(row.key, { groceryItemId: value === "__other" ? null : value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose item" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__other">Other (type a name)</SelectItem>
                        {(items.data?.items ?? []).map((item) => (
                          <SelectItem key={item.id} value={item.id}>
                            {item.nameEn} · {item.nameBn}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-5 sm:col-span-2">
                    <Select value={row.unit} onValueChange={(value) => update(row.key, { unit: value as Unit })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Input
                      inputMode="decimal"
                      value={row.quantity}
                      onChange={(event) => update(row.key, { quantity: event.target.value })}
                      placeholder="Qty"
                      aria-label="Quantity"
                    />
                  </div>
                  <div className="col-span-3 sm:col-span-3">
                    <Input
                      inputMode="decimal"
                      value={row.totalPriceTaka}
                      onChange={(event) => update(row.key, { totalPriceTaka: event.target.value })}
                      placeholder="৳ total"
                      aria-label="Total price"
                    />
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Remove row"
                      disabled={rows.length === 1}
                      onClick={() => setRows((prev) => prev.filter((entry) => entry.key !== row.key))}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                  {!row.groceryItemId ? (
                    <div className="col-span-12">
                      <Input
                        value={row.nameSnapshot}
                        onChange={(event) => update(row.key, { nameSnapshot: event.target.value })}
                        placeholder="Item name (free text)"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <p className="text-right text-sm text-muted-foreground">
              Total: {estimatedTotal.toFixed(2)} ৳ — enter the actual price paid for each item (the manager verifies it).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="bazar-notes">Notes (optional)</Label>
            <Textarea id="bazar-notes" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <div className="flex items-center gap-2">
            <Switch id="submit-now" checked={submitNow} onCheckedChange={setSubmitNow} />
            <Label htmlFor="submit-now">Submit for review immediately</Label>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={create.isPending}>
            Cancel
          </Button>
          <Button loading={create.isPending} disabled={!canSubmit} onClick={() => create.mutate()}>
            {submitNow ? "Save & submit" : "Save draft"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Purchase photos (private Cloudinary storage)                               */
/* -------------------------------------------------------------------------- */

function PhotosButton({ messId, entryId }: { messId: string; entryId: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="icon-sm" variant="outline" aria-label="Photos">
          <Images />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Purchase photos</DialogTitle>
          <DialogDescription>
            Receipt and shopping photos for this entry. Files are private — they are only readable through
            short-lived links.
          </DialogDescription>
        </DialogHeader>
        <EntryPhotos messId={messId} entryId={entryId} />
      </DialogContent>
    </Dialog>
  );
}

function EntryPhotos({ messId, entryId }: { messId: string; entryId: string }) {
  const queryClient = useQueryClient();

  const photos = useQuery({
    queryKey: qk.media(messId, { bazarEntryId: entryId }),
    queryFn: () => mediaApi.list(messId, { bazarEntryId: entryId }),
  });

  const remove = useMutation({
    mutationFn: (mediaId: string) => mediaApi.remove(messId, mediaId),
    onSuccess: () => {
      toast.success("Photo deleted");
      void queryClient.invalidateQueries({ queryKey: ["media", messId] });
    },
    onError: (error) => toast.error(error instanceof Error ? error.message : "Could not delete the photo"),
  });

  const items = photos.data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <ImageUpload
          messId={messId}
          kind="BAZAR_PHOTO"
          bazarEntryId={entryId}
          onUploaded={() => void queryClient.invalidateQueries({ queryKey: ["media", messId] })}
        />
      </div>

      {photos.isPending ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoadingAnimation label="Loading photos…" size="small" />
          <span>Loading photos…</span>
        </div>
      ) : photos.isError ? (
        <ErrorState error={photos.error} onRetry={() => void photos.refetch()} compact />
      ) : items.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-center text-sm text-muted-foreground">
          No photos yet. Upload the receipt or a photo of the shopping.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((media) => (
            <PhotoThumb
              key={media.id}
              messId={messId}
              media={media}
              deleting={remove.isPending && remove.variables === media.id}
              onDelete={() => remove.mutate(media.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoThumb({
  messId,
  media,
  onDelete,
  deleting,
}: {
  messId: string;
  media: MediaAsset;
  onDelete: () => void;
  deleting: boolean;
}) {
  // Signed links live for 15 minutes, so refresh them well before they lapse.
  const url = useQuery({
    queryKey: qk.mediaUrl(messId, media.id),
    queryFn: () => mediaApi.signedUrl(messId, media.id),
    staleTime: 10 * 60 * 1000,
  });

  return (
    <figure className="overflow-hidden rounded-md border bg-muted">
      {url.isPending ? (
        <div className="aspect-square w-full animate-pulse bg-muted" />
      ) : url.isError ? (
        <div className="flex aspect-square w-full items-center justify-center p-2 text-center text-xs text-muted-foreground">
          Preview unavailable
        </div>
      ) : (
        // A signed, expiring URL cannot go through next/image's optimiser.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url.data.url} alt="Bazar photo" className="aspect-square w-full object-cover" />
      )}
      <figcaption className="flex items-center justify-between gap-1 px-2 py-1 text-xs text-muted-foreground">
        <span className="tabular">{Math.max(1, Math.round((media.bytes ?? 0) / 1024))} KB</span>
        <Button variant="ghost" size="icon-sm" aria-label="Delete photo" loading={deleting} onClick={onDelete}>
          <Trash2 />
        </Button>
      </figcaption>
    </figure>
  );
}
