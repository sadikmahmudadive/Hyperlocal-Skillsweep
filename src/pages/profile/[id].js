import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import Modal from '../../components/ui/Modal';
import { useToast } from '../../contexts/ToastContext';

export default function UserProfile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [startingChat, setStartingChat] = useState(false);
  const [hireOpen, setHireOpen] = useState(false);
  const [hirePrefill, setHirePrefill] = useState(null);
  const [submittingHire, setSubmittingHire] = useState(false);
  const { user: currentUser, addFavorite, removeFavorite } = useAuth();
  const router = useRouter();
  const { id } = router.query;
  const { addToast } = useToast();
  const [reviews, setReviews] = useState([]);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewStats, setReviewStats] = useState({ average: 0, count: 0, distribution: {1:0,2:0,3:0,4:0,5:0} });
  const [favoriteLoading, setFavoriteLoading] = useState(false);
  const favoriteIds = currentUser?.favorites || [];
  const isFavorite = user?._id ? favoriteIds.some((fav) => String(fav) === String(user._id)) : false;

  useEffect(() => {
    if (id && id !== 'undefined') {
      fetchUserProfile();
    }
  }, [id]);

  useEffect(() => {
    if (user?._id) {
      // load first page of reviews when user is ready
      loadReviews(1, true);
      loadReviewStats();
    }
  }, [user?._id]);

  const fetchUserProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/users/${id}`);
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('User not found');
        } else {
          throw new Error('Failed to fetch user profile');
        }
      }
      
      const data = await response.json();
      setUser(data.user);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setError(error.message);
    }
    setLoading(false);
  };

  const loadReviewStats = async () => {
    try {
      const res = await fetch(`/api/reviews/stats?userId=${id}`);
      const data = await res.json();
      if (res.ok) setReviewStats(data);
    } catch (e) {
      console.error('Load review stats error', e);
    }
  };

  const loadReviews = async (page = 1, replace = false) => {
    if (!id) return;
    setReviewsLoading(true);
    try {
      const params = new URLSearchParams({ userId: id, page: String(page), limit: '10' });
      const res = await fetch(`/api/reviews?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setReviews((prev) => (replace ? data.reviews : [...prev, ...data.reviews]));
        setReviewsPage(data.page || page);
        setReviewsTotalPages(data.totalPages || 1);
      }
    } catch (e) {
      console.error('Load reviews error', e);
    } finally {
      setReviewsLoading(false);
    }
  };

  const startConversation = async () => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }

    // Allow starting chat even if the user has no listed skills

    setStartingChat(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId: id,
          skillTopic: user.skillsOffered?.[0]?.name || 'Skill Exchange',
          initialMessage: user.skillsOffered?.[0]?.name
            ? `Hi ${user.name}! I'm interested in your ${user.skillsOffered[0]?.name} skill. Would you like to arrange a skill swap?`
            : `Hi ${user.name}! I'd like to connect about a potential skill exchange.`
        })
      });

      const data = await response.json();
      if (response.ok) {
        router.push(`/chat?conversation=${data.conversation._id}`);
      } else {
        addToast({ type: 'error', title: 'Chat failed', message: data.message || 'Failed to start conversation' });
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      addToast({ type: 'error', title: 'Chat error', message: 'Please try again.' });
    }
    setStartingChat(false);
  };

  const openHire = (skill) => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    setHirePrefill(skill || null);
    setHireOpen(true);
  };

  const toggleFavorite = async () => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    if (favoriteLoading) return;
    try {
      setFavoriteLoading(true);
      if (isFavorite) {
        const result = await removeFavorite?.(user._id);
        if (result?.success) {
          addToast?.({ type: 'info', title: 'Removed', message: `${user.name} removed from favorites` });
        } else if (result?.error) {
          addToast?.({ type: 'error', title: 'Could not update favorites', message: result.error });
        }
      } else {
        const result = await addFavorite?.(user._id);
        if (result?.success) {
          addToast?.({ type: 'success', title: 'Favorited', message: `${user.name} was added to your favorites` });
        } else if (result?.error) {
          addToast?.({ type: 'error', title: 'Could not favorite', message: result.error });
        }
      }
    } finally {
      setFavoriteLoading(false);
    }
  };

  const submitHire = async ({ skillId, duration, credits, scheduled, custom }) => {
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }
    const selected = user?.skillsOffered?.find(s => (s._id && String(s._id) === String(skillId)) || (!s._id && s.name === skillId));
    // Build skill object: from selected skill, or from custom fields when selected is absent or custom option chosen
    let skillObj = null;
    if (selected) {
      skillObj = { name: selected.name, category: selected.category, description: selected.description };
    } else if (custom || skillId === '__custom__' || !(user?.skillsOffered?.length)) {
      const customName = custom?.name?.trim();
      const customDesc = (custom?.description || '').trim();
      if (!customName) {
        addToast({ type: 'error', title: 'Missing skill', message: 'Please enter the requested skill name' });
        return;
      }
      skillObj = { name: customName, category: 'other', description: customDesc };
    } else {
      addToast({ type: 'error', title: 'Missing skill', message: 'Please select a skill' });
      return;
    }
    if (!duration || duration <= 0) {
      addToast({ type: 'error', title: 'Invalid duration', message: 'Duration must be greater than 0' });
      return;
    }
    if (!credits || credits <= 0) {
      addToast({ type: 'error', title: 'Invalid credits', message: 'Credits must be greater than 0' });
      return;
    }

    try {
      setSubmittingHire(true);
      const token = localStorage.getItem('token');
      const body = {
        providerId: id,
        skill: skillObj,
        duration: Number(duration),
        credits: Number(credits),
        scheduledDate: scheduled ? new Date(scheduled).toISOString() : null
      };
      const res = await fetch('/api/transactions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok) {
        addToast({ type: 'success', title: 'Request sent', message: 'Waiting for provider to confirm' });
        setHireOpen(false);
        router.push('/dashboard/transactions?status=pending');
      } else {
        if (data?.code === 'INSUFFICIENT_CREDITS') {
          addToast({ type: 'warning', title: 'Add credits', message: `You need ${data.missingCredits} more credits (~${data.amountFiat} ${data.currency}).` });
          router.push(`/dashboard?topup=1&need=${encodeURIComponent(data.missingCredits)}`);
        } else {
          addToast({ type: 'error', title: 'Hire failed', message: data?.message || 'Could not create request' });
        }
      }
    } catch (e) {
      console.error('Hire error', e);
      addToast({ type: 'error', title: 'Error', message: 'Error creating request' });
    } finally {
      setSubmittingHire(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  if (error || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            {error || 'User not found'}
          </h1>
          <button 
            onClick={() => router.push('/search')}
            className="btn-primary"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Profile Header */}
        <div className="card p-6 mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center space-y-4 md:space-y-0 md:space-x-6">
            <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center text-white text-3xl font-bold">
              {user.name?.charAt(0) || 'U'}
            </div>
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-slate-100">{user.name}</h1>
              <p className="text-gray-600 dark:text-slate-300 mt-2">{user.bio || 'No bio provided'}</p>
              <div className="flex items-center space-x-6 mt-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{user.credits || 0}</div>
                  <div className="text-sm text-gray-500">Credits</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-600">
                    {user.rating?.average || '0'}/5
                  </div>
                  <div className="text-sm text-gray-500">Rating</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {user.rating?.count || reviews?.length || 0}
                  </div>
                  <div className="text-sm text-gray-500">Reviews</div>
                </div>
              </div>
            </div>
            {currentUser && currentUser.id !== user._id && (
              <div className="flex items-center gap-3">
                <button
                  onClick={toggleFavorite}
                  disabled={favoriteLoading}
                  className={`text-2xl leading-none transition-transform ${isFavorite ? 'text-rose-500 scale-110' : 'text-gray-300 hover:text-rose-400 hover:scale-110'}`}
                  title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                >
                  {isFavorite ? '♥' : '♡'}
                </button>
                <button
                  onClick={startConversation}
                  disabled={startingChat}
                  className="btn-primary px-6"
                >
                  {startingChat ? 'Starting Chat...' : 'Start Chat'}
                </button>
                <button
                  onClick={() => openHire(hirePrefill)}
                  disabled={submittingHire}
                  className="px-6 py-2 rounded-md border border-green-600 text-green-700 hover:bg-green-50 disabled:opacity-50"
                >
                  Hire
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Skills Offered */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Skills Offered</h2>
            <div className="space-y-3">
              {user.skillsOffered?.map((skill, index) => (
                <div key={skill._id || index} className="border rounded-lg p-4 dark:border-slate-700">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">{skill.name}</h3>
                      <p className="text-gray-600 dark:text-slate-300 text-sm mt-1">{skill.description}</p>
                      <div className="flex space-x-2 mt-2">
                        <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                          {skill.category}
                        </span>
                        <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded">
                          {skill.experience}
                        </span>
                      </div>
                    </div>
                    {currentUser && currentUser.id !== user._id && (
                      <button
                        onClick={() => { setHirePrefill(skill); setHireOpen(true); }}
                        className="btn-primary text-sm"
                      >
                        Hire for this skill
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(!user.skillsOffered || user.skillsOffered.length === 0) && (
                <p className="text-gray-500 dark:text-slate-400 text-center py-4">No skills offered yet</p>
              )}
            </div>
          </div>

          {/* Skills Needed */}
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">Skills Needed</h2>
            <div className="space-y-3">
              {user.skillsNeeded?.map((skill, index) => (
                <div key={skill._id || index} className="border rounded-lg p-4 dark:border-slate-700">
                  <h3 className="font-semibold text-lg">{skill.name}</h3>
                  <p className="text-gray-600 dark:text-slate-300 text-sm mt-1">{skill.description}</p>
                  <span className="bg-purple-100 text-purple-800 text-xs px-2 py-1 rounded mt-2 inline-block">
                    {skill.category}
                  </span>
                </div>
              ))}
              {(!user.skillsNeeded || user.skillsNeeded.length === 0) && (
                <p className="text-gray-500 dark:text-slate-400 text-center py-4">No skills needed listed</p>
              )}
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="card p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold">Reviews</h2>
            <div className="text-sm text-gray-600 dark:text-slate-400">
              Avg {reviewStats.average || user.rating?.average || 0}/5 • {reviewStats.count || user.rating?.count || 0} total
            </div>
          </div>
          {/* Star distribution */}
          <div className="mb-4 space-y-1">
            {[5,4,3,2,1].map((star) => {
              const count = reviewStats.distribution?.[star] || 0;
              const total = reviewStats.count || 0;
              const pct = total ? Math.round((count / total) * 100) : 0;
              return (
                <div key={star} className="flex items-center gap-2 text-sm">
                  <span className="w-10 text-right">{star}★</span>
                  <div className="flex-1 h-2 rounded bg-gray-100 dark:bg-slate-800 overflow-hidden">
                    <div className="h-full bg-yellow-400" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-12 text-right text-gray-600 dark:text-slate-400">{count}</span>
                </div>
              );
            })}
          </div>
          {reviewsLoading && reviews.length === 0 ? (
            <div className="text-center text-gray-600 dark:text-slate-300 py-6">Loading reviews…</div>
          ) : reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review._id} className="border-b pb-4 last:border-b-0 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-green-500/70">
                        <img
                          src={review.reviewer?.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(review.reviewer?.name || 'User')}&background=0ea5e9&color=fff&size=128&bold=true`}
                          alt={review.reviewer?.name || 'Reviewer'}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 dark:text-slate-100">{review.reviewer?.name || 'Anonymous'}</span>
                          <span className="text-yellow-500">{'⭐'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span>
                          <span className="text-xs text-gray-500 dark:text-slate-400">{new Date(review.createdAt).toLocaleDateString()}</span>
                        </div>
                        {review.transaction?.skill?.name && (
                          <div className="text-xs text-gray-500 dark:text-slate-400">Skill: {review.transaction.skill.name}</div>
                        )}
                      </div>
                    </div>
                  </div>
                  {review.comment && (
                    <p className="text-gray-700 dark:text-slate-200">{review.comment}</p>
                  )}
                </div>
              ))}
              {reviewsPage < reviewsTotalPages && (
                <div className="pt-2">
                  <button
                    onClick={() => loadReviews(reviewsPage + 1)}
                    disabled={reviewsLoading}
                    className="btn-secondary"
                  >
                    {reviewsLoading ? 'Loading…' : 'Load more'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-500 dark:text-slate-400 text-center py-4">No reviews yet</p>
          )}
        </div>
      </div>

      {/* Hire Modal */}
      <Modal open={hireOpen} onClose={() => setHireOpen(false)} title={`Hire ${user?.name}`}>
        {hireOpen && (
          <HireForm
            skills={user?.skillsOffered || []}
            prefill={hirePrefill}
            availableCredits={currentUser?.credits || 0}
            submitting={submittingHire}
            onSubmit={submitHire}
          />
        )}
      </Modal>
    </div>
  );
}

function HireForm({ skills, prefill, availableCredits, submitting, onSubmit }) {
  const hasSkills = Array.isArray(skills) && skills.length > 0;
  const [skillId, setSkillId] = useState(
    prefill?._id || prefill?.name || (hasSkills ? (skills[0]?._id || skills[0]?.name) : '__custom__')
  );
  const [duration, setDuration] = useState(1);
  const [credits, setCredits] = useState(1);
  const [scheduled, setScheduled] = useState('');
  const [customName, setCustomName] = useState('');
  const [customDescription, setCustomDescription] = useState('');

  useEffect(() => {
    if (prefill) {
      setSkillId(prefill._id || prefill.name);
    }
  }, [prefill]);

  useEffect(() => {
    if (duration && duration > 0) {
      setCredits(Number(duration));
    }
  }, [duration]);

  const onSubmitInternal = (e) => {
    e.preventDefault();
    const payload = { skillId, duration, credits, scheduled };
    if (skillId === '__custom__' || !hasSkills) {
      // Encode custom skill fields into the skillId for caller to detect or use separate fields
      payload.custom = { name: customName.trim(), description: customDescription.trim() };
    }
    onSubmit?.(payload);
  };

  return (
    <form onSubmit={onSubmitInternal} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Skill</label>
        {hasSkills ? (
          <select
            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            value={skillId}
            onChange={(e) => setSkillId(e.target.value)}
          >
            {skills.map((s) => (
              <option key={s._id || s.name} value={s._id || s.name}>{s.name}</option>
            ))}
            <option value="__custom__">Custom request…</option>
          </select>
        ) : (
          <div className="text-sm text-gray-600">This user hasn&apos;t listed any skills. Send a custom request:</div>
        )}
      </div>
      {(skillId === '__custom__' || !hasSkills) && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Requested Skill</label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g., Gardening help"
              className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Details (optional)</label>
            <textarea
              rows={3}
              value={customDescription}
              onChange={(e) => setCustomDescription(e.target.value)}
              placeholder="Describe what you need"
              className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>
        </div>
  )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Duration (hours)</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={duration}
            onChange={(e) => setDuration(parseFloat(e.target.value))}
            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">Credits</label>
            <span className="text-xs text-gray-500">Available: {availableCredits}</span>
          </div>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={credits}
            onChange={(e) => setCredits(parseFloat(e.target.value))}
            className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date (optional)</label>
        <input
          type="datetime-local"
          value={scheduled}
          onChange={(e) => setScheduled(e.target.value)}
          className="w-full border rounded-md p-2 focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>
      <div className="flex justify-end space-x-2">
        <button type="button" onClick={onSubmitInternal} disabled={submitting} className="btn-secondary">
          {submitting ? 'Submitting...' : 'Submit Request'}
        </button>
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? 'Submitting...' : 'Hire'}
        </button>
      </div>
    </form>
  );
}