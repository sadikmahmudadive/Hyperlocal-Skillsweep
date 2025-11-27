import { useState, useEffect } from 'react';
import { useAuth, useRequireAuth } from '../../contexts/AuthContext';
import useAutoRefresh from '../../hooks/useAutoRefresh';
import { useToast } from '../../contexts/ToastContext';
import { Skeleton } from '../../components/ui/Skeleton';
import Modal from '../../components/ui/Modal';
import { useRouter } from 'next/router';
import { Button } from '../../components/ui/Button';
import { useRefresh } from '../../contexts/RefreshContext';

export default function Transactions() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState([]);
  const [categorized, setCategorized] = useState({});
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [reviewedMap, setReviewedMap] = useState({}); // transactionId -> true
  const [reviewedDetails, setReviewedDetails] = useState({}); // transactionId -> { id, rating, comment }
  const [reviewModal, setReviewModal] = useState({ open: false, transaction: null, targetUser: null });
  const [editReview, setEditReview] = useState(null); // { id, rating, comment }
  const [submittingReview, setSubmittingReview] = useState(false);
  const router = useRouter();
  const { addToast } = useToast();
  const { triggerRefresh } = useRefresh() || {};
  
  useRequireAuth();
  // Auto refresh transactions every 60s
  useAutoRefresh(60000);

  useEffect(() => {
    fetchTransactions();
  }, []);

  // Initialize active tab from URL (?status=pending|confirmed|in-progress|completed|all)
  useEffect(() => {
    if (!router.isReady) return;
    const s = router.query.status;
    if (typeof s === 'string' && ['all','pending','confirmed','in-progress','completed'].includes(s)) {
      setActiveTab(s);
    }
  }, [router.isReady, router.query.status]);

  const fetchTransactions = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions?status=all', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
        setCategorized(data.categorized);
        // After fetching transactions, check which completed ones are already reviewed by current user
        const ids = data.transactions
          .filter(t => t.status === 'completed')
          .map(t => t._id);
        if (ids.length) {
          const existsRes = await fetch('/api/reviews/exists-batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ transactionIds: ids })
          });
          if (existsRes.ok) {
            const existsData = await existsRes.json();
            const map = {};
            existsData.reviewedTransactionIds.forEach(id => { map[id] = true; });
            setReviewedMap(map);
            setReviewedDetails(existsData.reviewsByTransaction || {});
          }
        } else {
          setReviewedMap({});
        }
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    }
    setLoading(false);
  };

  const refreshTransactions = async (message = 'Refreshing exchanges…') => {
    const exec = () => fetchTransactions();
    if (triggerRefresh) {
      await triggerRefresh({ message, refreshFn: exec });
    } else {
      await exec();
    }
  };

  const confirmTransaction = async (transactionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId })
      });

      if (response.ok) {
        addToast({ type: 'success', title: 'Confirmed', message: 'Transaction confirmed' });
        await refreshTransactions('Updating transaction stream…');
      } else {
        const data = await response.json();
        addToast({ type: 'error', title: 'Confirm failed', message: data.message || 'Unable to confirm' });
      }
    } catch (error) {
      console.error('Error confirming transaction:', error);
      addToast({ type: 'error', title: 'Error', message: 'Error confirming transaction' });
    }
  };

  const startTransaction = async (transactionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId })
      });

      if (response.ok) {
        addToast({ type: 'success', title: 'Started', message: 'Service started' });
        await refreshTransactions('Refreshing progress…');
      } else {
        const data = await response.json();
        addToast({ type: 'error', title: 'Start failed', message: data.message || 'Unable to start service' });
      }
    } catch (error) {
      console.error('Error starting transaction:', error);
      addToast({ type: 'error', title: 'Error', message: 'Error starting transaction' });
    }
  };

  const completeTransaction = async (transactionId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/transactions/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ transactionId })
      });

      if (response.ok) {
        addToast({ type: 'success', title: 'Completed', message: 'Transaction completed' });
        await refreshTransactions('Syncing completion…');
      } else {
        const data = await response.json();
        addToast({ type: 'error', title: 'Complete failed', message: data.message || 'Unable to complete' });
      }
    } catch (error) {
      console.error('Error completing transaction:', error);
      addToast({ type: 'error', title: 'Error', message: 'Error completing transaction' });
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'confirmed': 'bg-blue-100 text-blue-800 border-blue-200',
      'in-progress': 'bg-purple-100 text-purple-800 border-purple-200',
      'completed': 'bg-green-100 text-green-800 border-green-200',
      'cancelled': 'bg-red-100 text-red-800 border-red-200'
    };
    return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getActionButtons = (transaction) => {
    const buttons = [];
    
    if (transaction.status === 'pending' && transaction.provider._id === user.id) {
      buttons.push(
        <Button
          key="confirm"
          onClick={() => confirmTransaction(transaction._id)}
          className="px-3 py-1 text-sm"
        >
          Confirm
        </Button>
      );
    }
    
    if (transaction.status === 'confirmed') {
      buttons.push(
        <Button
          key="start"
          onClick={() => startTransaction(transaction._id)}
          className="px-3 py-1 text-sm"
        >
          Start Service
        </Button>
      );
    }
    
    if (transaction.status === 'in-progress') {
      buttons.push(
        <Button
          key="complete"
          onClick={() => completeTransaction(transaction._id)}
          className="px-3 py-1 text-sm"
        >
          Complete
        </Button>
      );
    }

    // Write review button on completed transactions if user hasn't reviewed yet
    if (transaction.status === 'completed') {
      const alreadyReviewed = reviewedMap[transaction._id];
      const isReviewer = transaction.provider._id === user.id || transaction.receiver._id === user.id;
      if (isReviewer && !alreadyReviewed) {
        const targetUser = transaction.provider._id === user.id ? transaction.receiver : transaction.provider;
        buttons.push(
          <Button
            key="review"
            variant="secondary"
            className="px-3 py-1 text-sm"
            onClick={() => setReviewModal({ open: true, transaction, targetUser })}
          >
            Write Review
          </Button>
        );
      } else if (isReviewer && alreadyReviewed) {
        const details = reviewedDetails[transaction._id];
        const createdAtMs = details?.createdAt ? new Date(details.createdAt).getTime() : null;
        const remainingMs = createdAtMs ? Math.max(0, (24 * 60 * 60 * 1000) - (Date.now() - createdAtMs)) : 0;
        const remainingH = Math.ceil(remainingMs / (60 * 60 * 1000));
        const canEdit = !!details?.id && remainingMs > 0;
        buttons.push(
          <div key="reviewed" className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Reviewed{details?.rating ? `: ${'⭐'.repeat(details.rating)}${'☆'.repeat(5 - details.rating)}` : ''}
            </span>
            {canEdit && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setEditReview({ id: details.id, rating: details.rating || 5, comment: details.comment || '' });
                  setReviewModal({ open: true, transaction, targetUser: transaction.provider._id === user.id ? transaction.receiver : transaction.provider });
                }}
                className="text-xs text-green-700 hover:text-green-800 underline"
              >
                Edit
              </button>
            )}
            {!canEdit && details?.id && (
              <span className="text-[11px] text-gray-400" title="Edits allowed for 24h after posting">
                Edit window expired
              </span>
            )}
            {canEdit && (
              <span className="text-[11px] text-gray-400" title="Edits allowed for 24h after posting">
                {remainingH}h left
              </span>
            )}
          </div>
        );
      }
    }

    return buttons;
  };

  const tabs = [
    { id: 'all', name: 'All', count: transactions.length },
    { id: 'pending', name: 'Pending', count: categorized.pending?.length || 0 },
    { id: 'confirmed', name: 'Confirmed', count: categorized.confirmed?.length || 0 },
    { id: 'in-progress', name: 'In Progress', count: categorized.inProgress?.length || 0 },
    { id: 'completed', name: 'Completed', count: categorized.completed?.length || 0 }
  ];

  const key = activeTab === 'in-progress' ? 'inProgress' : activeTab;
  const filteredTransactions = activeTab === 'all' 
    ? transactions 
    : categorized[key] || [];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">Transaction History</h1>
          <p className="text-gray-600 dark:text-slate-300 mt-2">Manage your skill exchanges and credits</p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); router.push({ pathname: router.pathname, query: { ...router.query, status: tab.id } }, undefined, { shallow: true }); }}
                className={`whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab.id
                    ? 'border-green-500 text-green-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.name}
                {tab.count > 0 && (
                  <span className={`ml-2 py-0.5 px-2 text-xs rounded-full ${
                    activeTab === tab.id ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-600'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>

        {/* Transactions List */}
        {loading ? (
          <div className="card p-6">
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <Skeleton className="w-10 h-10 rounded-full" />
                    <div>
                      <Skeleton className="h-4 w-40 mb-2" />
                      <Skeleton className="h-3 w-64" />
                    </div>
                  </div>
                  <Skeleton className="h-8 w-24" />
                </div>
              ))}
            </div>
          </div>
        ) : filteredTransactions.length > 0 ? (
          <div className="bg-white dark:bg-slate-900/60 shadow overflow-hidden sm:rounded-md border border-gray-200 dark:border-slate-800">
            <ul className="divide-y divide-gray-200 dark:divide-slate-800">
              {filteredTransactions.map((transaction) => (
                <li key={transaction._id}>
                  <div className="px-4 py-4 sm:px-6 hover:bg-gray-50 dark:hover:bg-slate-800/40">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-semibold ${
                            transaction.provider._id === user.id ? 'bg-green-500' : 'bg-blue-500'
                          }`}>
                            {transaction.provider._id === user.id ? '↑' : '↓'}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="flex items-center">
                            <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                              {transaction.skill.name}
                            </h4>
                            <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                              {transaction.status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-slate-300">
                            {transaction.provider._id === user.id 
                              ? `You provided to ${transaction.receiver.name}`
                              : `You received from ${transaction.provider.name}`
                            }
                          </p>
                          <p className="text-sm text-gray-500 dark:text-slate-400">
                            Duration: {transaction.duration}h
                            {transaction.amount > 0 && ` • Price: ${transaction.amount} ${transaction.currency || 'BDT'}`}
                            {transaction.discount > 0 && ` • Discount: -${transaction.discount} ${transaction.currency || 'BDT'}`}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {getActionButtons(transaction)}
                        <div className="text-right">
                          {transaction.amount > 0 ? (
                            <>
                              <span className="block text-lg font-semibold text-green-600">
                                {transaction.finalAmount} {transaction.currency || 'BDT'}
                              </span>
                              {transaction.discount > 0 && (
                                <span className="block text-xs text-gray-500">
                                  <span className="line-through">{transaction.amount}</span>
                                  <span className="ml-1 text-green-600">(-{transaction.credits}⏱️)</span>
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-lg font-semibold text-green-600">
                              {transaction.credits}⏱️
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    {transaction.scheduledDate && (
                      <div className="mt-2 text-sm text-gray-500 dark:text-slate-400">
                        Scheduled: {new Date(transaction.scheduledDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="card p-8 text-center">
            <div className="text-6xl mb-4">📋</div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">No transactions found</h3>
            <p className="text-gray-600 dark:text-slate-300">
              {activeTab === 'all' 
                ? "You haven't made any transactions yet."
                : `You don't have any ${activeTab} transactions.`
              }
            </p>
          </div>
        )}
      </div>

      {/* Review Modal */}
      <Modal
        open={reviewModal.open}
        onClose={() => { setReviewModal({ open: false, transaction: null, targetUser: null }); setEditReview(null); }}
        title={reviewModal.targetUser ? `${editReview ? 'Edit' : 'Review'} ${reviewModal.targetUser.name}` : (editReview ? 'Edit Review' : 'Write Review')}
      >
        {reviewModal.open && (
          <ReviewForm
            submitting={submittingReview}
            initialRating={editReview?.rating}
            initialComment={editReview?.comment}
            onDelete={editReview ? async () => {
              try {
                setSubmittingReview(true);
                const token = localStorage.getItem('token');
                const res = await fetch(`/api/reviews/${editReview.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
                const data = await res.json();
                if (res.ok) {
                  addToast({ type: 'success', title: 'Deleted', message: 'Review deleted' });
                  setReviewedMap(prev => ({ ...prev, [reviewModal.transaction._id]: false }));
                  setReviewedDetails(prev => { const copy = { ...prev }; delete copy[reviewModal.transaction._id]; return copy; });
                  setEditReview(null);
                  setReviewModal({ open: false, transaction: null, targetUser: null });
                  fetchTransactions();
                } else {
                  addToast({ type: 'error', title: 'Delete failed', message: data.message || 'Could not delete review' });
                }
              } catch (e) {
                console.error('Delete review error', e);
                addToast({ type: 'error', title: 'Error', message: 'Error deleting review' });
              } finally {
                setSubmittingReview(false);
              }
            } : undefined}
            onSubmit={async (rating, comment) => {
              if (!reviewModal.transaction || !reviewModal.targetUser) return;
              try {
                setSubmittingReview(true);
                const token = localStorage.getItem('token');
                const isEdit = !!editReview?.id;
                const res = isEdit
                  ? await fetch(`/api/reviews/${editReview.id}`, {
                      method: 'PUT',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({ rating, comment })
                    })
                  : await fetch('/api/reviews/create', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                      body: JSON.stringify({
                        targetUserId: reviewModal.targetUser._id,
                        rating,
                        comment,
                        transactionId: reviewModal.transaction._id
                      })
                    });
                const data = await res.json();
                if (res.ok) {
                  addToast({ type: 'success', title: isEdit ? 'Review updated' : 'Review submitted', message: isEdit ? 'Your review was updated.' : 'Thanks for your feedback!' });
                  setReviewedMap(prev => ({ ...prev, [reviewModal.transaction._id]: true }));
                  setReviewedDetails(prev => ({ ...prev, [reviewModal.transaction._id]: { id: editReview?.id || data?.review?._id, rating, comment } }));
                  setEditReview(null);
                  setReviewModal({ open: false, transaction: null, targetUser: null });
                  fetchTransactions();
                } else {
                  addToast({ type: 'error', title: 'Review failed', message: data.message || 'Could not submit review' });
                }
              } catch (e) {
                console.error('Submit review error', e);
                addToast({ type: 'error', title: 'Error', message: 'Error submitting review' });
              } finally {
                setSubmittingReview(false);
              }
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ReviewForm({ submitting, onSubmit, initialRating, initialComment, onDelete }) {
  const [rating, setRating] = useState(typeof initialRating === 'number' ? initialRating : 5);
  const [comment, setComment] = useState(initialComment || '');
  const [fieldErrors, setFieldErrors] = useState({});
  const { addToast } = useToast();

  useEffect(() => {
    if (typeof initialRating === 'number') setRating(initialRating);
  }, [initialRating]);

  useEffect(() => {
    if (typeof initialComment === 'string') setComment(initialComment);
  }, [initialComment]);

  useEffect(() => {
    // clear field errors when user types
    if (fieldErrors.comment && comment.length <= 500) setFieldErrors(prev => ({ ...prev, comment: undefined }));
    if (fieldErrors.rating && rating >=1 && rating <=5) setFieldErrors(prev => ({ ...prev, rating: undefined }));
  }, [comment, rating]);

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); onSubmit?.(rating, comment); }}
      className="space-y-4"
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Rating</label>
        <div className="flex items-center space-x-1">
          {[1,2,3,4,5].map((r) => (
            <button
              key={r}
              type="button"
              aria-label={`${r} star${r>1?'s':''}`}
              onClick={() => setRating(r)}
              className={`h-9 w-9 rounded-full flex items-center justify-center border transition ${r <= rating ? 'bg-yellow-400 border-yellow-500 text-white' : 'bg-white dark:bg-slate-900 border-gray-300 dark:border-slate-700 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-800'}`}
            >
              {r <= rating ? '⭐' : '☆'}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-200 mb-1">Comment (optional)</label>
        <textarea
          className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-100"
          rows={4}
          maxLength={500}
          placeholder="Share your experience..."
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-invalid={fieldErrors.comment ? 'true' : 'false'}
          aria-describedby={fieldErrors.comment ? 'comment-error' : undefined}
        />
        {fieldErrors.comment && <div id="comment-error" className="text-xs text-rose-600 mt-1">{fieldErrors.comment}</div>}
        <div className="text-xs text-gray-500 dark:text-slate-400 text-right">{comment.length}/500</div>
      </div>
      <div className="flex justify-between space-x-2">
        <div>
          {onDelete && (
            <Button
              type="button"
              variant="secondary"
              className="border-rose-300/60 text-rose-500 hover:border-rose-400 hover:text-rose-600 dark:border-rose-500/30 dark:text-rose-200"
              disabled={submitting}
              onClick={() => onDelete?.()}
            >
              {submitting ? 'Deleting…' : 'Delete Review'}
            </Button>
          )}
        </div>
        <Button
          type="submit"
          loading={submitting}
          disabled={submitting || !(rating >=1 && rating <=5) || (comment.length > 500)}
          onClick={(e) => {
            // defensive client-side validation before calling onSubmit
            const errs = {};
            if (!(rating >=1 && rating <=5)) errs.rating = 'Please select a rating between 1 and 5';
            if (comment.length > 500) errs.comment = 'Comment must be 500 characters or fewer';
            setFieldErrors(errs);
            if (Object.keys(errs).length > 0) {
              e.preventDefault();
              addToast({ type: 'error', title: 'Validation', message: 'Please fix errors before submitting' });
              return;
            }
            // otherwise allow form submit to proceed
          }}
        >
          {onDelete ? 'Update Review' : 'Submit Review'}
        </Button>
      </div>
    </form>
  );
}