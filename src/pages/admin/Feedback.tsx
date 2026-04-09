/**
 * Admin Feedback page — view and manage user-submitted feedback.
 *
 * Protected by an API key gate stored in sessionStorage.
 * Uses shadcn/ui components (Table, Dialog, Select, Badge, Button, Input, Card).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { getFeedbackItems, updateFeedback, type FeedbackItem } from '@/lib/feedbackStorage';

const ADMIN_API_KEY_SESSION_KEY = 'real-bee-admin-api-key';
const EXPECTED_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'admin-dev-key';

const PAGE_SIZE = 25;

function statusColor(status: FeedbackItem['status']) {
  switch (status) {
    case 'new': return 'bg-blue-100 text-blue-700 hover:bg-blue-100';
    case 'reviewing': return 'bg-amber-100 text-amber-700 hover:bg-amber-100';
    case 'resolved': return 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100';
    case 'wont_fix': return 'bg-gray-100 text-gray-700 hover:bg-gray-100';
  }
}

function relativeTime(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AdminFeedback() {
  const [apiKey, setApiKey] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [page, setPage] = useState(0);
  const [selectedItem, setSelectedItem] = useState<FeedbackItem | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');

  useEffect(() => {
    const savedKey = sessionStorage.getItem(ADMIN_API_KEY_SESSION_KEY);
    if (savedKey === EXPECTED_API_KEY) {
      setAuthenticated(true);
    }
  }, []);

  const loadItems = useCallback(() => {
    setItems(getFeedbackItems());
  }, []);

  const handleLogin = () => {
    if (apiKey === EXPECTED_API_KEY) {
      sessionStorage.setItem(ADMIN_API_KEY_SESSION_KEY, apiKey);
      setAuthenticated(true);
      loadItems();
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem(ADMIN_API_KEY_SESSION_KEY);
    setAuthenticated(false);
    setApiKey('');
  };

  const handleStatusChange = (id: string, newStatus: FeedbackItem['status']) => {
    const updated = updateFeedback(id, {
      status: newStatus,
      resolutionNote: newStatus === 'resolved' || newStatus === 'wont_fix' ? resolutionNote || null : null,
    });
    if (updated) {
      loadItems();
      setSelectedItem(updated);
    }
  };

  const filteredItems = items.filter(item => {
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const totalPages = Math.ceil(filteredItems.length / PAGE_SIZE);
  const pagedItems = filteredItems.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Admin Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="api-key">API Key</Label>
              <Input
                id="api-key"
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="Enter admin API key"
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>
            <Button onClick={handleLogin} className="w-full">
              Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Feedback Dashboard</h1>
          <Button variant="outline" onClick={handleLogout}>
            Logout
          </Button>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-4">
              <div className="flex-1 min-w-[200px]">
                <Label htmlFor="search">Search</Label>
                <Input
                  id="search"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0); }}
                  placeholder="Search title or description..."
                />
              </div>
              <div className="w-[160px]">
                <Label>Type</Label>
                <Select value={filterType} onValueChange={v => { setFilterType(v); setPage(0); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="bug">Bug</SelectItem>
                    <SelectItem value="feature">Feature</SelectItem>
                    <SelectItem value="feedback">Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-[160px]">
                <Label>Status</Label>
                <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(0); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="new">New</SelectItem>
                    <SelectItem value="reviewing">Reviewing</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="pt-6">
            {pagedItems.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No feedback items found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedItems.map(item => (
                    <TableRow key={item.id} className="cursor-pointer hover:bg-slate-50" onClick={() => { setSelectedItem(item); setResolutionNote(item.resolutionNote || ''); }}>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">{item.type}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate">{item.title}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColor(item.status)}>
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{relativeTime(item.createdAt)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={e => { e.stopPropagation(); setSelectedItem(item); setResolutionNote(item.resolutionNote || ''); }}>
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filteredItems.length)} of {filteredItems.length}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detail Dialog */}
        <Dialog open={!!selectedItem} onOpenChange={open => { if (!open) setSelectedItem(null); }}>
          {selectedItem && (
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{selectedItem.title}</DialogTitle>
                <DialogDescription>
                  Submitted {new Date(selectedItem.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Type</Label>
                  <p className="capitalize">{selectedItem.type}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <Select value={selectedItem.status} onValueChange={v => handleStatusChange(selectedItem.id, v as FeedbackItem['status'])}>
                    <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">New</SelectItem>
                      <SelectItem value="reviewing">Reviewing</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="wont_fix">Won&apos;t Fix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Description</Label>
                  <p className="text-sm whitespace-pre-wrap mt-1">{selectedItem.description}</p>
                </div>
                {(selectedItem.gamePhase || selectedItem.score !== undefined) && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Game Phase</Label>
                      <p className="text-sm">{selectedItem.gamePhase || '—'}</p>
                    </div>
                    <div>
                      <Label>Score / Streak</Label>
                      <p className="text-sm">{selectedItem.score ?? '—'} / {selectedItem.streak ?? '—'}</p>
                    </div>
                  </div>
                )}
                <div>
                  <Label>User Agent</Label>
                  <p className="text-xs text-muted-foreground break-all">{selectedItem.userAgent}</p>
                </div>
                {(selectedItem.status === 'resolved' || selectedItem.status === 'wont_fix') && (
                  <div>
                    <Label>Resolution Note</Label>
                    <p className="text-sm whitespace-pre-wrap mt-1">{selectedItem.resolutionNote || '—'}</p>
                  </div>
                )}
                {(selectedItem.status === 'resolved' || selectedItem.status === 'wont_fix') && (
                  <div>
                    <Label htmlFor="resolution-note">Update Resolution Note</Label>
                    <Input
                      id="resolution-note"
                      value={resolutionNote}
                      onChange={e => setResolutionNote(e.target.value)}
                      placeholder="Add resolution notes..."
                    />
                    <DialogFooter className="mt-2">
                      <Button size="sm" onClick={() => handleStatusChange(selectedItem.id, selectedItem.status)}>
                        Save Note
                      </Button>
                    </DialogFooter>
                  </div>
                )}
              </div>
            </DialogContent>
          )}
        </Dialog>
      </div>
    </div>
  );
}
