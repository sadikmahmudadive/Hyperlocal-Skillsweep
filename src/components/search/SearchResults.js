import { useRouter } from 'next/router';
import { useAuth } from '../../contexts/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

export default function SearchResults({ users, loading, onUserSelect, onHire, currentLocation, favorites = [], onToggleFavorite }) {
  const router = useRouter();
  const { user: currentUser } = useAuth();

  const handleUserClick = (user) => {
    // Use the correct ID field - try _id first, then id
    const userId = user._id || user.id;
    
    if (onUserSelect) {
      onUserSelect(user);
    } else {
      // Default behavior: navigate to profile
      router.push(`/profile/${userId}`);
    }
  };

  const startChatWithUser = async (user, e) => {
    e.stopPropagation(); // Prevent triggering the user click
    
    if (!currentUser) {
      router.push('/auth/login');
      return;
    }

    const userId = user._id || user.id;
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId: userId,
          skillTopic: user.skillsOffered?.[0]?.name || 'Skill Exchange',
          initialMessage: `Hi ${user.name}! I saw your profile and I'm interested in connecting for a skill swap.`
        })
      });

      const data = await response.json();
      if (response.ok) {
        router.push(`/chat?conversation=${data.conversation._id}`);
      } else {
        alert(data.message || 'Failed to start conversation');
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      alert('Error starting conversation. Please try again.');
    }
  };

  const getSkillBadges = (skills, max = 3) => {
    if (!skills || skills.length === 0) return [];
    return skills.slice(0, max).map(skill => skill.name);
  };

  const haversineKm = (coordA, coordB) => {
    if (!coordA || !coordB) return null;
    const toRad = (d) => (d * Math.PI) / 180;
    const [lng1, lat1] = coordA;
    const [lng2, lat2] = coordB;
    const R = 6371; // km
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-6 py-10 text-center">
        <LoadingSpinner size="large" />
        <p className="text-sm text-slate-500 dark:text-slate-300">Scanning the neighborhood for skilled neighbors…</p>
      </div>
    );
  }

  const total = users.length;

  return (
    <div className="flex h-full min-h-[360px] flex-col overflow-hidden rounded-[28px]">
      <div className="flex items-center justify-between border-b border-soft surface-card px-5 py-4 text-[11px] font-semibold uppercase tracking-[0.32em] text-muted">
        <span>Matches</span>
        <span>{total}</span>
      </div>

      <div className="flex-1 overflow-y-auto surface-muted">
        {total === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="text-5xl">🔍</div>
            <h3 className="font-display text-xl font-semibold text-strong">No matches yet</h3>
            <p className="max-w-xs text-sm text-muted">
              Adjust your filters or try a broader distance to discover more neighbors.
            </p>
          </div>
        ) : (
          users.map((user) => {
            const userId = String(user._id || user.id);
            const isFavorite = favorites.includes(userId);
            return (
              <button
                key={userId}
                type="button"
                onClick={() => handleUserClick(user)}
                className="group relative flex w-full flex-col gap-4 px-5 py-4 text-left transition-all duration-200 hover:-translate-y-[1px] hover:bg-[rgba(var(--panel),0.92)] hover:shadow-inner"
              >
                <div className="flex items-start gap-4">
              <div className="border-t border-soft surface-card px-5 py-3 text-center text-xs text-muted">
                    <img
                      src={user.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || 'U')}&background=0ea5e9&color=fff&size=128&bold=true`}
                      alt={user.name || 'User avatar'}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="flex items-center gap-2 font-display text-lg font-semibold text-strong">
                          <span className="truncate">{user.name}</span>
                          {user.online && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-200">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              Online
                            </span>
                          )}
                        </h3>
                        <p className="text-sm text-muted line-clamp-2">
                          {user.bio || 'This neighbor hasn\'t added a bio yet, but is ready to swap skills!'}
                        </p>
                      </div>
                      {currentUser && currentUser.id !== userId && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(user); }}
                            className={`inline-flex h-9 w-9 items-center justify-center rounded-full border text-lg transition-all duration-200 ${isFavorite ? 'border-rose-300 bg-rose-500/20 text-rose-500 hover:bg-rose-500/30 dark:border-rose-500/40 dark:text-rose-200' : 'border-slate-200 text-slate-400 hover:border-rose-300 hover:text-rose-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-rose-500/40 dark:hover:text-rose-200'}`}
                            title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                          >
                            {isFavorite ? '♥' : '♡'}
                          </button>
                          <button
                            onClick={(e) => startChatWithUser(user, e)}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-emerald-300 bg-emerald-50/70 px-3 text-xs font-semibold uppercase tracking-[0.3em] text-emerald-700 transition hover:border-emerald-400 hover:bg-emerald-100/70 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200"
                            title="Start chat"
                          >
                            Chat
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); onHire?.(user); }}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-sky-300 bg-sky-50/70 px-3 text-xs font-semibold uppercase tracking-[0.3em] text-sky-700 transition hover:border-sky-400 hover:bg-sky-100/70 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200"
                            title="Hire"
                          >
                            Hire
                          </button>
                        </div>
                      )}
                    </div>

                    {user.skillsOffered?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {getSkillBadges(user.skillsOffered).map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200"
                          >
                            {skill}
                          </span>
                        ))}
                        {user.skillsOffered.length > 3 && (
                          <span className="rounded-full bg-slate-100/70 px-3 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800/60 dark:text-slate-300">
                            +{user.skillsOffered.length - 3}
                          </span>
                        )}
                      </div>
                    )}

                    {user.skillsNeeded?.length > 0 && (
                      <div className="flex flex-wrap gap-2 text-xs text-slate-400 dark:text-slate-400">
                        <span className="font-semibold uppercase tracking-[0.3em]">Needs:</span>
                        {getSkillBadges(user.skillsNeeded, 2).map((skill) => (
                          <span key={skill} className="rounded-full bg-purple-500/10 px-3 py-1 text-xs font-semibold text-purple-600 dark:bg-purple-500/20 dark:text-purple-200">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="inline-flex items-center gap-2 rounded-full bg-amber-100/60 px-3 py-1 text-xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-200">
                          ⭐ {Number(user.rating?.average || 0).toFixed(1)}
                          <span className="text-[11px] text-amber-600/70 dark:text-amber-200/80">({user.rating?.count || 0})</span>
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100/60 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-200">
                          ⏱️ {user.credits || 0} credits
                        </div>
                      </div>
                      {(() => {
                        const userCoords = user.location?.coordinates;
                        const km = (typeof user.distance === 'number' ? user.distance : haversineKm(userCoords, currentLocation));
                        return km ? (
                          <span className="text-xs text-slate-400 dark:text-slate-400">{km.toFixed(1)} km away</span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>

      {total > 0 && (
        <div className="border-t border-soft surface-card px-5 py-3 text-center text-xs text-muted">
          Tip: click any profile to view details, start a chat, or bookmark it for later swaps.
        </div>
      )}
    </div>
  );
}