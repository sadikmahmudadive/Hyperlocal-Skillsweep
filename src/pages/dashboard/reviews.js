import { useEffect, useState } from 'react';
import { useAuth, useRequireAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import Modal from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';

export default function MyReviews() {
  const { user } = useAuth();
  useRequireAuth();
  const { addToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [editModal, setEditModal] = useState({ open: false, review: null });

  useEffect(() => {
    fetchReviews(1, true);
  }, []);

  const fetchReviews = async (p = 1, replace = false) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = new URLSearchParams({ page: String(p), limit: '10', authored: 'true' });
      const res = await fetch(`/api/reviews?${params.toString()}`, { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        setReviews(prev => replace ? data.reviews : [...prev, ...data.reviews]);
        setPage(data.page || p);
        setTotalPages(data.totalPages || 1);
      } else {
        addToast({ type: 'error', title: 'Load failed', message: data.message || 'Could not load reviews' });
      }
    } catch (e) {
      console.error('Load my reviews error', e);
      addToast({ type: 'error', title: 'Error', message: 'Error loading reviews' });
    } finally {
      setLoading(false);
    }
  };

  const onDelete = async () => {
    if (!editModal.review) return;
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reviews/${editModal.review._id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: 'success', title: 'Deleted', message: 'Review deleted' });
        setReviews(prev => prev.filter(r => r._id !== editModal.review._id));
        setEditModal({ open: false, review: null });
      } else {
        addToast({ type: 'error', title: 'Delete failed', message: data.message || 'Could not delete review' });
      }
    } catch (e) {
      console.error('Delete review error', e);
      addToast({ type: 'error', title: 'Error', message: 'Error deleting review' });
    } finally {
      setSubmitting(false);
    }
  };

  const onSave = async (rating, comment) => {
    if (!editModal.review) return;
    try {
      setSubmitting(true);
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/reviews/${editModal.review._id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ rating, comment })
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: 'success', title: 'Saved', message: 'Review updated' });
        setReviews(prev => prev.map(r => r._id === editModal.review._id ? { ...r, rating, comment } : r));
        setEditModal({ open: false, review: null });
      } else {
        addToast({ type: 'error', title: 'Update failed', message: data.message || 'Could not update review' });
      }
    } catch (e) {
      console.error('Update review error', e);
      addToast({ type: 'error', title: 'Error', message: 'Error updating review' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-strong">My Reviews</h1>
          <p className="text-secondary mt-1">Reviews you&apos;ve written for others</p>
        </div>

        {loading && reviews.length === 0 ? (
          <div className="card p-6 text-center">Loading…</div>
        ) : reviews.length === 0 ? (
          <div className="card p-6 text-center">You haven&apos;t written any reviews yet.</div>
        ) : (
          <div className="card p-4 divide-y dark:divide-slate-800">
            {reviews.map((r) => {
              const createdAtMs = new Date(r.createdAt).getTime();
              const remainingMs = Math.max(0, (24*60*60*1000) - (Date.now() - createdAtMs));
              const canEdit = remainingMs > 0;
              const remainingH = Math.ceil(remainingMs / (60*60*1000));
              const targetName = r.transaction?.provider?._id === user?.id ? r.transaction?.receiver?.name : r.transaction?.provider?.name;
              const skillName = r.transaction?.skill?.name || 'Skill Exchange';
              return (
                <div key={r._id} className="py-4 flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium dark:text-slate-100">{targetName || 'User'}</span>
                      <span className="text-yellow-500">{'⭐'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                      <span className="text-xs text-muted">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="text-xs text-muted">Skill: {skillName}</div>
                    {r.comment && <p className="mt-1 text-secondary">{r.comment}</p>}
                  </div>
                  <div className="text-right space-y-1">
                    <button
                      className="text-sm text-emerald-700 hover:text-emerald-800 dark:text-emerald-300 dark:hover:text-emerald-200 underline disabled:no-underline disabled:text-soft"
                      disabled={!canEdit}
                      onClick={() => setEditModal({ open: true, review: r })}
                    >
                      Edit
                    </button>
                    <div className="text-[11px] text-soft">{canEdit ? `${remainingH}h left` : 'Edit window expired'}</div>
                  </div>
                </div>
              );
            })}
            {page < totalPages && (
              <div className="pt-3">
                <Button
                  variant="secondary"
                  disabled={loading}
                  onClick={() => fetchReviews(page + 1)}
                >
                  {loading ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Modal open={editModal.open} onClose={() => setEditModal({ open: false, review: null })} title="Edit Review">
        {editModal.open && (
          <EditForm
            submitting={submitting}
            initialRating={editModal.review?.rating}
            initialComment={editModal.review?.comment}
            onSubmit={onSave}
            onDelete={onDelete}
          />
        )}
      </Modal>
    </div>
  );
}

function EditForm({ submitting, onSubmit, initialRating, initialComment, onDelete }) {
  const [rating, setRating] = useState(typeof initialRating === 'number' ? initialRating : 5);
  const [comment, setComment] = useState(initialComment || '');
  useEffect(() => { if (typeof initialRating === 'number') setRating(initialRating); }, [initialRating]);
  useEffect(() => { if (typeof initialComment === 'string') setComment(initialComment); }, [initialComment]);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit?.(rating, comment); }} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">Rating</label>
        <div className="flex items-center gap-1">
          {[1,2,3,4,5].map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRating(r)}
              className={`h-9 w-9 rounded-full border transition ${r <= rating ? 'bg-yellow-400 border-yellow-500 text-white' : 'bg-white/80 dark:bg-slate-900/60 border-soft text-muted hover:bg-white dark:hover:bg-slate-800/40'}`}
            >
              {r <= rating ? '⭐' : '☆'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-secondary mb-1">Comment</label>
        <textarea rows={4} className="input-field" maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
      </div>
      <div className="flex justify-between">
        <Button
          type="button"
          variant="secondary"
          className="border-rose-300/60 text-rose-500 hover:border-rose-400 hover:text-rose-600"
          disabled={submitting}
          onClick={() => onDelete?.()}
        >
          {submitting ? 'Deleting…' : 'Delete Review'}
        </Button>
        <Button type="submit" loading={submitting} disabled={submitting}>
          {submitting ? 'Saving…' : 'Save'}
        </Button>
      </div>
    </form>
  );
}
