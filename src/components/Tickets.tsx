import { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, Plus, Send, AlertCircle, CheckCircle2, ImagePlus, X } from 'lucide-react';
import type { User } from '../App';
import { ticketAPI } from '../utils/api';
import { toast } from 'sonner';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';

interface TicketAttachment {
  name: string;
  mimeType: string;
  size: number;
  dataUrl: string;
  uploadedAt?: string;
}

interface TicketComment {
  _id: string;
  authorName: string;
  authorEmail: string;
  authorRole: string;
  message: string;
  attachments?: TicketAttachment[];
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
  attachments?: TicketAttachment[];
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
const MAX_TICKET_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
const MAX_TICKET_IMAGE_COUNT = 4;

const ticketSelectTriggerClass =
  'w-full border-gray-200/80 dark:border-gray-600/80 bg-gradient-to-b from-white to-gray-50 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-gray-100 shadow-sm';

export function Tickets({ user, getToken }: TicketsProps) {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [processingTicketImages, setProcessingTicketImages] = useState(false);
  const [processingCommentImages, setProcessingCommentImages] = useState(false);

  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'GENERAL' as Ticket['category'],
    priority: 'MEDIUM' as Ticket['priority'],
  });

  const [commentMessage, setCommentMessage] = useState('');
  const [ticketImages, setTicketImages] = useState<TicketAttachment[]>([]);
  const [commentImages, setCommentImages] = useState<TicketAttachment[]>([]);

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const fileToAttachment = (file: File): Promise<TicketAttachment> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== 'string') {
          reject(new Error('Failed to process image file'));
          return;
        }
        resolve({
          name: file.name,
          mimeType: file.type,
          size: file.size,
          dataUrl: reader.result,
        });
      };
      reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
      reader.readAsDataURL(file);
    });

  const handleImageSelection = async (
    files: FileList | null,
    currentImages: TicketAttachment[],
    setImages: React.Dispatch<React.SetStateAction<TicketAttachment[]>>,
    setProcessing: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (!files || files.length === 0) return;

    const selectedFiles = Array.from(files);
    const availableSlots = MAX_TICKET_IMAGE_COUNT - currentImages.length;

    if (availableSlots <= 0) {
      toast.error(`You can attach up to ${MAX_TICKET_IMAGE_COUNT} images`);
      return;
    }

    const filesToProcess = selectedFiles.slice(0, availableSlots);
    if (selectedFiles.length > filesToProcess.length) {
      toast.error(`Only ${MAX_TICKET_IMAGE_COUNT} images are allowed per ticket/comment`);
    }

    const validFiles = filesToProcess.filter((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error(`${file.name} is not an image file`);
        return false;
      }
      if (file.size > MAX_TICKET_IMAGE_SIZE_BYTES) {
        toast.error(`${file.name} is larger than 2MB`);
        return false;
      }
      return true;
    });

    if (validFiles.length === 0) return;

    try {
      setProcessing(true);
      const nextAttachments = await Promise.all(validFiles.map(fileToAttachment));
      setImages((prev) => [...prev, ...nextAttachments]);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to process selected images');
    } finally {
      setProcessing(false);
    }
  };

  const removeImageAt = (
    index: number,
    setImages: React.Dispatch<React.SetStateAction<TicketAttachment[]>>
  ) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

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
    if (processingTicketImages) {
      toast.error('Please wait until ticket images finish processing');
      return;
    }
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required');
      return;
    }

    try {
      setCreating(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const response = await ticketAPI.create(token, { ...form, attachments: ticketImages });
      const createdTicket = response.ticket as Ticket | undefined;

      if (createdTicket?._id) {
        setTickets((prev) => [createdTicket, ...prev.filter((t) => t._id !== createdTicket._id)]);
        setSelectedTicketId(createdTicket._id);
      }

      toast.success('Ticket created');
      setForm({ title: '', description: '', category: 'GENERAL', priority: 'MEDIUM' });
      setTicketImages([]);
      await loadTickets();
    } catch (error: any) {
      toast.error(error?.message || 'Failed to create ticket');
    } finally {
      setCreating(false);
    }
  };

  const handleAddComment = async () => {
    if (processingCommentImages) {
      toast.error('Please wait until comment images finish processing');
      return;
    }
    if (!selectedTicket || (!commentMessage.trim() && commentImages.length === 0)) return;

    try {
      setCommenting(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication required');
      const response = await ticketAPI.addComment(token, selectedTicket._id, {
        message: commentMessage,
        attachments: commentImages,
      });
      const updated = response.ticket;
      setTickets((prev) => prev.map((t) => (t._id === updated._id ? updated : t)));
      setCommentMessage('');
      setCommentImages([]);
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

  const isOwnComment = (comment: TicketComment) =>
    comment.authorEmail?.toLowerCase() === user.email.toLowerCase();

  const isTicketAnnouncement = (comment: TicketComment) => {
    if ((comment.attachments || []).length > 0) return false;
    const message = (comment.message || '').trim();
    if (!message) return false;
    return /^ticket\s(created|updated|closed|resolved|reopened|assigned)/i.test(message);
  };

  const hasCommentWithAttachments = (selectedTicket?.comments || []).some(
    (comment) => (comment.attachments || []).length > 0
  );
  const shouldInjectTicketAttachmentMessage =
    (selectedTicket?.attachments || []).length > 0 && !hasCommentWithAttachments;

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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Category
                </label>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, category: value as Ticket['category'] }))}
                >
                  <SelectTrigger aria-label="Ticket category" className={ticketSelectTriggerClass}>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((c) => (
                      <SelectItem key={c} value={c}>{c.replace('_', ' ')}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  Priority
                </label>
                <Select
                  value={form.priority}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, priority: value as Ticket['priority'] }))}
                >
                  <SelectTrigger aria-label="Ticket priority" className={ticketSelectTriggerClass}>
                    <SelectValue placeholder="Select priority" />
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map((p) => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-200 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition">
                <ImagePlus className="h-4 w-4" />
                Attach Images ({ticketImages.length}/{MAX_TICKET_IMAGE_COUNT})
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    void handleImageSelection(e.target.files, ticketImages, setTicketImages, setProcessingTicketImages);
                    e.target.value = '';
                  }}
                />
              </label>

              {processingTicketImages && (
                <p className="text-[11px] text-gray-500">Processing selected images...</p>
              )}

              {ticketImages.length > 0 && (
                <div className="grid grid-cols-2 gap-2">
                  {ticketImages.map((image, index) => (
                    <div key={`${image.name}-${index}`} className="relative rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-700">
                      <img src={image.dataUrl} alt={image.name} className="h-24 w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImageAt(index, setTicketImages)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                        aria-label={`Remove ${image.name}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      <div className="px-2 py-1 text-[10px] text-gray-600 dark:text-gray-300 truncate">
                        {image.name} • {formatBytes(image.size)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={creating || processingTicketImages}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 text-sm font-medium disabled:opacity-50"
            >
              {creating ? 'Creating...' : processingTicketImages ? 'Preparing Images...' : 'Create Ticket'}
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
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Status
                      </label>
                      <Select
                        disabled={updating}
                        value={selectedTicket.status}
                        onValueChange={(value) => handleAdminUpdate({ status: value as Ticket['status'] })}
                      >
                        <SelectTrigger aria-label="Admin ticket status" className={ticketSelectTriggerClass}>
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map((s) => (
                            <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        Priority
                      </label>
                      <Select
                        disabled={updating}
                        value={selectedTicket.priority}
                        onValueChange={(value) => handleAdminUpdate({ priority: value as Ticket['priority'] })}
                      >
                        <SelectTrigger aria-label="Admin ticket priority" className={ticketSelectTriggerClass}>
                          <SelectValue placeholder="Select priority" />
                        </SelectTrigger>
                        <SelectContent>
                          {priorityOptions.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-gradient-to-b from-gray-50/80 to-white dark:from-gray-800/90 dark:to-gray-800 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">Conversation</h4>
                  <span className="text-xs text-gray-500">
                    {(selectedTicket.comments || []).length} message{(selectedTicket.comments || []).length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-3 max-h-[340px] overflow-y-auto p-4">
                  {shouldInjectTicketAttachmentMessage && (
                    <div
                      className={`flex ${selectedTicket.createdBy.email?.toLowerCase() === user.email.toLowerCase() ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className="max-w-[90%] sm:max-w-[78%]">
                        <div
                          className={`mb-1 flex items-center gap-2 text-[11px] ${
                            selectedTicket.createdBy.email?.toLowerCase() === user.email.toLowerCase()
                              ? 'justify-end text-emerald-700 dark:text-emerald-300'
                              : 'text-gray-500'
                          }`}
                        >
                          <span className="font-semibold">
                            {selectedTicket.createdBy.email?.toLowerCase() === user.email.toLowerCase() ? 'You' : selectedTicket.createdBy.name}
                          </span>
                          <span>{new Date(selectedTicket.createdAt).toLocaleString()}</span>
                        </div>
                        <div
                          className={`rounded-2xl border px-3 py-2 ${
                            selectedTicket.createdBy.email?.toLowerCase() === user.email.toLowerCase()
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800/70 dark:text-emerald-100'
                              : 'bg-white border-gray-200 text-gray-800 dark:bg-gray-700/60 dark:border-gray-600 dark:text-gray-100'
                          }`}
                        >
                          <p className="text-sm">Attached images</p>
                          <div className="mt-2 grid grid-cols-2 gap-2">
                            {(selectedTicket.attachments || []).map((image, index) => (
                              <a
                                key={`${selectedTicket._id}-chat-attachment-${index}`}
                                href={image.dataUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden bg-black/5 dark:bg-white/5 block"
                              >
                                <img src={image.dataUrl} alt={image.name || `Attachment ${index + 1}`} className="h-24 w-full object-cover" />
                              </a>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {(selectedTicket.comments || []).length === 0 ? (
                    <div className="text-sm text-gray-500">No messages yet. Start the conversation below.</div>
                  ) : (
                    (selectedTicket.comments || []).map((comment) => {
                      if (isTicketAnnouncement(comment)) {
                        return (
                          <div key={comment._id} className="flex justify-center">
                            <div className="rounded-full border border-gray-200 dark:border-gray-600 bg-gray-100/90 dark:bg-gray-700/80 px-3 py-1 text-[11px] text-gray-600 dark:text-gray-300">
                              {comment.message}
                            </div>
                          </div>
                        );
                      }

                      const ownMessage = isOwnComment(comment);
                      return (
                        <div key={comment._id} className={`flex ${ownMessage ? 'justify-end' : 'justify-start'}`}>
                          <div className="max-w-[90%] sm:max-w-[78%]">
                            <div className={`mb-1 flex items-center gap-2 text-[11px] ${ownMessage ? 'justify-end text-emerald-700 dark:text-emerald-300' : 'text-gray-500'}`}>
                              <span className="font-semibold">{ownMessage ? 'You' : comment.authorName}</span>
                              <span>{new Date(comment.createdAt).toLocaleString()}</span>
                            </div>
                            <div
                              className={`rounded-2xl border px-3 py-2 ${
                                ownMessage
                                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-900/20 dark:border-emerald-800/70 dark:text-emerald-100'
                                  : 'bg-white border-gray-200 text-gray-800 dark:bg-gray-700/60 dark:border-gray-600 dark:text-gray-100'
                              }`}
                            >
                              {comment.message && (
                                <p className="text-sm whitespace-pre-wrap break-words">{comment.message}</p>
                              )}
                              {(comment.attachments || []).length > 0 && (
                                <div className="mt-2 grid grid-cols-2 gap-2">
                                  {(comment.attachments || []).map((image, index) => (
                                    <a
                                      key={`${comment._id}-attachment-${index}`}
                                      href={image.dataUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="rounded-lg border border-black/10 dark:border-white/10 overflow-hidden bg-black/5 dark:bg-white/5 block"
                                    >
                                      <img src={image.dataUrl} alt={image.name || `Attachment ${index + 1}`} className="h-24 w-full object-cover" />
                                    </a>
                                  ))}
                                </div>
                              )}
                            </div>
                            {!ownMessage && (
                              <div className="mt-1 text-[10px] text-gray-500">
                                {comment.authorRole}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 p-3 space-y-2 bg-white/90 dark:bg-gray-800/90">
                  <div className="flex items-center gap-2">
                    <input
                      value={commentMessage}
                      onChange={(e) => setCommentMessage(e.target.value)}
                      placeholder="Write a message"
                      className="flex-1 px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm"
                    />
                    <button
                      onClick={handleAddComment}
                      disabled={commenting || (!commentMessage.trim() && commentImages.length === 0)}
                      className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 inline-flex items-center gap-1"
                    >
                      <Send className="w-4 h-4" />
                      Send
                    </button>
                  </div>

                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/60 px-3 py-2 text-xs font-medium text-gray-600 dark:text-gray-200 hover:border-emerald-400 hover:text-emerald-600 dark:hover:text-emerald-300 transition">
                    <ImagePlus className="h-4 w-4" />
                    Attach Images ({commentImages.length}/{MAX_TICKET_IMAGE_COUNT})
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => {
                        void handleImageSelection(e.target.files, commentImages, setCommentImages, setProcessingCommentImages);
                        e.target.value = '';
                      }}
                    />
                  </label>

                  {processingCommentImages && (
                    <p className="text-[11px] text-gray-500">Processing selected images...</p>
                  )}

                  {commentImages.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {commentImages.map((image, index) => (
                        <div key={`${image.name}-${index}`} className="relative rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden bg-gray-100 dark:bg-gray-700">
                          <img src={image.dataUrl} alt={image.name} className="h-24 w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeImageAt(index, setCommentImages)}
                            className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80"
                            aria-label={`Remove ${image.name}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                          <div className="px-2 py-1 text-[10px] text-gray-600 dark:text-gray-300 truncate">
                            disabled={commenting || processingCommentImages || (!commentMessage.trim() && commentImages.length === 0)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
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
