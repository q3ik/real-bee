/**
 * Feedback storage — localStorage-backed feedback persistence for admin review.
 *
 * In production, feedback submitted via FeedbackDialog is also stored locally
 * so admins can review it via the admin panel. For cloud-synced feedback,
 * the Sentry integration handles remote delivery.
 */

const STORAGE_KEY = 'real-bee-feedback';

export interface FeedbackItem {
  id: string;
  type: 'bug' | 'feature' | 'feedback';
  title: string;
  description: string;
  status: 'new' | 'reviewing' | 'resolved' | 'wont_fix';
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string | null;
  resolutionNote?: string | null;
  userAgent: string;
  url: string;
  gamePhase?: string;
  score?: number;
  streak?: number;
}

export function saveFeedback(item: Omit<FeedbackItem, 'id' | 'createdAt' | 'updatedAt'>): FeedbackItem {
  const now = new Date().toISOString();
  const newItem: FeedbackItem = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };

  const items = getFeedbackItems();
  items.unshift(newItem);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return newItem;
}

export function getFeedbackItems(): FeedbackItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function updateFeedback(id: string, updates: Partial<Pick<FeedbackItem, 'status' | 'resolutionNote'>>): FeedbackItem | null {
  const items = getFeedbackItems();
  const index = items.findIndex(i => i.id === id);
  if (index === -1) return null;

  items[index] = {
    ...items[index],
    ...updates,
    updatedAt: new Date().toISOString(),
    resolvedAt: updates.status === 'resolved' || updates.status === 'wont_fix'
      ? new Date().toISOString()
      : updates.status === 'new' || updates.status === 'reviewing'
        ? null
        : items[index].resolvedAt,
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  return items[index];
}

export function getFeedbackStats() {
  const items = getFeedbackItems();
  return {
    total: items.length,
    new: items.filter(i => i.status === 'new').length,
    reviewing: items.filter(i => i.status === 'reviewing').length,
    resolved: items.filter(i => i.status === 'resolved').length,
    wontFix: items.filter(i => i.status === 'wont_fix').length,
  };
}
