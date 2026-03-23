import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, Plus, Send, AlertCircle, CheckCircle2 } from 'lucide-react';
import type { User } from '../App';
import { ticketAPI } from '../utils/api';
import { toast } from 'sonner';

interface TicketComment {
  _id: string;
  authorName: string;
  authorEmail: string;
  authorRole: string;
  message: string;
  createdAt: string;
}

interface Ticket {
  _id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: 'GENERAL' | 'TECHNICAL' | 'BILLING' | 'TRANSFER' | 'VERIFICATION' | 'OTHER';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  createdBy: {
    userId: string;
    email: string;
    name: string;
    role: string;
    companyName?: string;
  };
  assignedTo?: {
    userId?: string;
    email?: string;
    name?: string;
  };
  comments: TicketComment[];
  createdAt: string;
  updatedAt: string;
}

interface TicketsProps {
  user: User;
  getToken: () => Promise<string | null>;
}

const categoryOptions: Ticket['category'][] = ['GENERAL', 'TECHNICAL', 'BILLING', 'TRANSFER', 'VERIFICATION', 'OTHER'];
const priorityOptions: Ticket['priority'][] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const statusOptions: Ticket['status'][] = ['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];

export function Tickets({ user, getToken }: TicketsProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'GENERAL' as Ticket['category'],
    priority: 'MEDIUM' as Ticket['priority'],
  });

  const [commentMessage, setCommentMessage] = useState('');

  const selectedTicket = useMemo(
    () => tickets.find((t) => t._id === selectedTicketId) || tickets[0] || null,
    [tickets, selectedTicketId]
  );

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;
      const response = await ticketAPI.list(token);
      const nextTickets = response.tickets || [];
      setTickets(nextTickets);
      if (!selectedTicketId && nextTickets.length > 0) {
        setSelectedTicketId(nextTickets[0]._id);
      }
      if (selectedTicketId && !nextTickets.some((t: Ticket) => t._id === selectedTicketId)) {
        setSelectedTicketId(nextTickets[0]?._id || '');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load tickets');
    } finally {
      setLoading(false);
    }
  }, [getToken, selectedTicketId]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      loadTickets();
    }, 30000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        loadTickets();
      }
    };

    const handleWindowFocus = () => {
      loadTickets();
    };

    const handleRealtimeUpdate = () => {
      loadTickets();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('mediscan:realtime-update', handleRealtimeUpdate);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('mediscan:realtime-update', handleRealtimeUpdate);
    };
  }, [loadTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    try {
      setCreating(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      await ticketAPI.create(token, form);
      toast.success('Ticket created');
      setForm({ title: '', description: '', category: 'GENERAL', priority: 'MEDIUM' });
      await loadTickets();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const handleAddComment = async () => {
    if (!selectedTicket || !commentMessage.trim()) return;

    try {
      setCommenting(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const response = await ticketAPI.addComment(token, selectedTicket._id, { message: commentMessage });
      const updated = response.ticket;
      setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      setCommentMessage('');
      toast.success('Comment added');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to add comment');
    } finally {
      setCommenting(false);
    }
  };

  const handleAdminUpdate = async (updates: Partial<Pick<Ticket, 'status' | 'priority'>>) => {
    if (!selectedTicket || user.role !== 'ADMIN') return;
    try {
      setUpdating(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const response = await ticketAPI.update(token, selectedTicket._id, updates);
      const updated = response.ticket;
      setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      toast.success('Ticket updated');
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  const badgeColor = (status: Ticket['status']) => {
    if (status === 'OPEN') return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    if (status === 'IN_PROGRESS') return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    if (status === 'RESOLVED') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    return 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Support Tickets</h2>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {user.role === 'ADMIN' ? 'Manage all user tickets and updates' : 'Create and track your support requests'}
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">Live sync active (instant push updates)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-6">
          <form onSubmit={handleCreateTicket} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Ticket
            </h3>
            <input
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Ticket title"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm"
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Describe your issue"
              rows={4}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm resize-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                aria-label="Ticket category"
                value={form.category}
                onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value as Ticket['category'] }))}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm"
              >
                {categoryOptions.map((c) => (
                  <option key={c} value={c}>{c.replace('_', ' ')}</option>
                ))}
              </select>
              <select
                aria-label="Ticket priority"
                value={form.priority}
                onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value as Ticket['priority'] }))}
                className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm"
              >
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={creating}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Ticket'}
            </button>
          </form>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-4">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Tickets</h3>
            <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
              {loading ? (
                <div className="text-sm text-gray-500">Loading tickets...</div>
              ) : tickets.length === 0 ? (
                <div className="text-sm text-gray-500">No tickets yet</div>
              ) : (
                tickets.map((ticket) => (
                  <button
                    key={ticket._id}
                    onClick={() => setSelectedTicketId(ticket._id)}
                    className={`w-full text-left rounded-xl border p-3 transition ${
                      selectedTicket?._id === ticket._id
                        ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/40'
                    }`}
                  >
                    <div className="text-xs text-gray-500 mb-1">{ticket.ticketNumber}</div>
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100 line-clamp-1">{ticket.title}</div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${badgeColor(ticket.status)}`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span className="text-[11px] text-gray-500">{new Date(ticket.updatedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="xl:col-span-2 bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 min-h-[580px]">
          {!selectedTicket ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500">
              <MessageSquare className="w-10 h-10 opacity-30 mb-2" />
              Select a ticket to view details
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-gray-500 mb-1">{selectedTicket.ticketNumber}</div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{selectedTicket.title}</h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {selectedTicket.createdBy.name} ({selectedTicket.createdBy.email})
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${badgeColor(selectedTicket.status)}`}>
                    {selectedTicket.status.replace('_', ' ')}
                  </span>
                  <span className="px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200">
                    {selectedTicket.priority}
                  </span>
                </div>
              </div>

              <div className="rounded-xl bg-gray-50 dark:bg-gray-700/40 p-4 text-sm text-gray-700 dark:text-gray-200">
                {selectedTicket.description}
              </div>

              {user.role === 'ADMIN' && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="text-sm font-semibold mb-3 text-gray-900 dark:text-gray-100">Admin Controls</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <select
                      aria-label="Admin ticket status"
                      disabled={updating}
                      value={selectedTicket.status}
                      onChange={(e) => handleAdminUpdate({ status: e.target.value as Ticket['status'] })}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    >
                      {statusOptions.map((s) => (
                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                      ))}
                    </select>
                    <select
                      aria-label="Admin ticket priority"
                      disabled={updating}
                      value={selectedTicket.priority}
                      onChange={(e) => handleAdminUpdate({ priority: e.target.value as Ticket['priority'] })}
                      className="px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    >
                      {priorityOptions.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Conversation</h4>
                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {(selectedTicket.comments || []).map((comment) => (
                    <div key={comment._id} className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="font-medium">{comment.authorName} ({comment.authorRole})</span>
                        <span>{new Date(comment.createdAt).toLocaleString()}</span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-200 mt-1">{comment.message}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  value={commentMessage}
                  onChange={(e) => setCommentMessage(e.target.value)}
                  placeholder="Add a comment"
                  className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm"
                />
                <button
                  onClick={handleAddComment}
                  disabled={commenting || !commentMessage.trim()}
                  className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1"
                >
                  <Send className="w-4 h-4" />
                  Send
                </button>
              </div>

              <div className="text-xs text-gray-500 flex items-center gap-2">
                {selectedTicket.status === 'RESOLVED' || selectedTicket.status === 'CLOSED' ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    This ticket has been marked as {selectedTicket.status.toLowerCase()}.
                  </>
                ) : (
                  <>
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    Add details in comments for faster resolution.
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
