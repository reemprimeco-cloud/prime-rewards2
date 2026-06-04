import { useState } from "react";
import { trpc } from "@/lib/trpc";
import AdminLayout from "@/components/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Trash2, CheckCircle, Clock, AlertTriangle, Search, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";

export default function AdminRegistry() {
  const [search, setSearch] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({
    invoiceNumber: "",
    customerPhone: "",
    amount: "",
    invoiceDate: "",
    customerName: "",
    notes: "",
  });

  const { data: entries = [], refetch, isLoading } = trpc.registry.list.useQuery({ limit: 200 }) as any;

  const addMutation = trpc.registry.add.useMutation({
    onSuccess: () => {
      toast.success("Invoice added to registry — auto-approval is now active.");
      setAddOpen(false);
      setForm({ invoiceNumber: "", customerPhone: "", amount: "", invoiceDate: "", customerName: "", notes: "" });
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.registry.delete.useMutation({
    onSuccess: () => { toast.success("Entry removed"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const autoApproveMutation = trpc.registry.autoApprove.useMutation({
    onSuccess: (data) => {
      const messages: Record<string, string> = {
        approved: "Invoice auto-approved and points awarded!",
        phone_mismatch: "Phone mismatch — invoice left pending for manual review.",
        not_in_registry: "Invoice not found in registry.",
        already_used: "Invoice already claimed by another account.",
      };
      toast.success(messages[data.result] ?? data.result);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = entries.filter((e: any) => {
    const q = search.toLowerCase();
    return (
      e.invoiceNumber.toLowerCase().includes(q) ||
      (e.customerPhone ?? "").includes(q) ||
      (e.customerName ?? "").toLowerCase().includes(q)
    );
  });

  const handleAdd = () => {
    if (!form.invoiceNumber || !form.customerPhone || !form.amount) {
      toast.error("Invoice number, phone, and amount are required.");
      return;
    }
    addMutation.mutate({
      invoiceNumber: form.invoiceNumber,
      customerPhone: form.customerPhone,
      amount: parseFloat(form.amount),
      invoiceDate: form.invoiceDate || undefined,
      customerName: form.customerName || undefined,
      notes: form.notes || undefined,
    });
  };

  const statusBadge = (entry: any) => {
    if (entry.isUsed) return <Badge className="bg-green-100 text-green-800 border-green-200"><CheckCircle className="w-3 h-3 mr-1" />Used</Badge>;
    return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Clock className="w-3 h-3 mr-1" />Available</Badge>;
  };

  return (
    <AdminLayout>
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Invoice Registry</h1>
            <p className="text-sm text-gray-500 mt-1">
              Add invoices here to enable automatic approval. When a customer submits an invoice number that matches their registered phone, it is approved instantly.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="w-4 h-4 mr-1" /> Refresh
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-blue-900 hover:bg-blue-800">
                  <Plus className="w-4 h-4 mr-1" /> Add Invoice
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Add Invoice to Registry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div>
                    <Label>Invoice Number *</Label>
                    <Input
                      placeholder="e.g. INV-2024-001"
                      value={form.invoiceNumber}
                      onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Customer Phone * (Kuwait)</Label>
                    <Input
                      placeholder="e.g. +965 5500 1234 or 55001234"
                      value={form.customerPhone}
                      onChange={(e) => setForm({ ...form, customerPhone: e.target.value })}
                    />
                    <p className="text-xs text-gray-500 mt-1">Must match the phone number on the customer's account exactly.</p>
                  </div>
                  <div>
                    <Label>Invoice Amount (KD) *</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 150.000"
                      value={form.amount}
                      onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>Invoice Date</Label>
                      <Input
                        type="date"
                        value={form.invoiceDate}
                        onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Customer Name</Label>
                      <Input
                        placeholder="Optional"
                        value={form.customerName}
                        onChange={(e) => setForm({ ...form, customerName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label>Notes</Label>
                    <Input
                      placeholder="Optional internal notes"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                  <Button
                    className="w-full bg-blue-900 hover:bg-blue-800"
                    onClick={handleAdd}
                    disabled={addMutation.isPending}
                  >
                    {addMutation.isPending ? "Adding..." : "Add to Registry"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-amber-800">
            <p className="font-semibold mb-1">How Auto-Approval Works</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Add the invoice number and the customer's registered phone number below.</li>
              <li>When the customer submits that invoice number, the system checks if their account phone matches.</li>
              <li>If it matches → invoice is <strong>auto-approved instantly</strong> and WhatsApp notification is sent.</li>
              <li>If it doesn't match → invoice stays <strong>pending for manual review</strong> and a fraud attempt is logged.</li>
            </ol>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-900">{entries.length}</div>
            <div className="text-xs text-gray-500">Total Entries</div>
          </div>
          <div className="bg-white border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-green-600">{entries.filter((e: any) => e.isUsed).length}</div>
            <div className="text-xs text-gray-500">Used / Claimed</div>
          </div>
          <div className="bg-white border rounded-lg p-3 text-center">
            <div className="text-2xl font-bold text-blue-600">{entries.filter((e: any) => !e.isUsed).length}</div>
            <div className="text-xs text-gray-500">Available</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by invoice number, phone, or customer name..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Table */}
        <div className="bg-white border rounded-lg overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-gray-500">Loading registry...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center">
              <Upload className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 font-medium">No invoices in registry</p>
              <p className="text-sm text-gray-400 mt-1">Add invoices above to enable automatic approval for customers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Customer Phone</TableHead>
                    <TableHead>Customer Name</TableHead>
                    <TableHead>Amount (KD)</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((entry: any) => (
                    <TableRow key={entry.id} className={entry.isUsed ? "bg-green-50/50" : ""}>
                      <TableCell className="font-mono font-semibold text-blue-900">{entry.invoiceNumber}</TableCell>
                      <TableCell className="font-mono text-sm">{entry.customerPhone}</TableCell>
                      <TableCell className="text-sm">{entry.customerName ?? <span className="text-gray-400">—</span>}</TableCell>
                      <TableCell className="font-semibold">
                        {entry.amount ? parseFloat(entry.amount).toFixed(3) : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {entry.invoiceDate ? new Date(entry.invoiceDate).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>{statusBadge(entry)}</TableCell>
                      <TableCell className="text-xs text-gray-500">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!entry.isUsed && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2"
                              onClick={() => {
                                if (confirm(`Manually trigger auto-approval check for invoice ${entry.invoiceNumber}?`)) {
                                  // We need an invoice submission ID — this triggers from the admin side
                                  toast.info("To manually trigger auto-approval, go to Admin → Invoices and click 'Auto-Approve' on a pending invoice.");
                                }
                              }}
                            >
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Check
                            </Button>
                          )}
                          {!entry.isUsed && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                              onClick={() => {
                                if (confirm(`Remove invoice ${entry.invoiceNumber} from registry?`)) {
                                  deleteMutation.mutate({ id: entry.id });
                                }
                              }}
                              disabled={deleteMutation.isPending}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
