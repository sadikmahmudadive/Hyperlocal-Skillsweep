import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuth, useRequireAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

export default function FavoritesPage() {
  const { user, refreshFavorites, removeFavorite, requireAuth } = useAuth();
  const [favoriteUsers, setFavoriteUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();
  const router = useRouter();
  useRequireAuth();

  useEffect(() => {
    if (!user) return;
    loadFavorites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const loadFavorites = async () => {
    try {
      setLoading(true);
      const data = await refreshFavorites?.();
      if (data?.favorites) {
        setFavoriteUsers(data.favorites);
      } else {
        setFavoriteUsers([]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (id, name) => {
    const result = await removeFavorite?.(id);
    if (result?.success) {
      setFavoriteUsers(prev => prev.filter(f => f._id !== id && f.id !== id));
      addToast?.({ type: 'info', title: 'Removed from favorites', message: `${name} will no longer appear in your favorites list.` });
    } else if (result?.error) {
      addToast?.({ type: 'error', title: 'Could not update favorites', message: result.error });
    }
  };

  const handleStartChat = requireAuth(async (provider) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          recipientId: provider.id || provider._id,
          skillTopic: provider.skillsOffered?.[0]?.name || 'Skill Exchange',
          initialMessage: `Hi ${provider.name}! I saved your profile and would love to connect.`
        })
      });
      const data = await response.json();
      if (response.ok) {
        router.push(`/chat?conversation=${data.conversation._id}`);
      } else {
        addToast?.({ type: 'error', title: 'Chat unavailable', message: data.message || 'Could not start chat.' });
      }
    } catch (error) {
      console.error('Favorites chat error:', error);
      addToast?.({ type: 'error', title: 'Chat error', message: 'Please try again.' });
    }
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <h1 className="text-3xl font-bold text-gray-900">Saved providers</h1>
          <p className="text-gray-600 mt-1">Quickly reconnect with your favorite neighbors.</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Favorites list</h2>
            <p className="text-sm text-gray-500">You can save up to 20 providers. Remove one any time.</p>
          </div>
          <Link href="/search" className="inline-flex items-center gap-2 px-3 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50">
            <span>🔍</span>
            <span>Find more providers</span>
          </Link>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow-sm p-8 text-center text-gray-500">
            Loading favorites...
          </div>
        ) : favoriteUsers.length === 0 ? (
          <div className="bg-white rounded-lg shadow-sm p-10 text-center">
            <div className="text-5xl mb-4">💚</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No favorites yet</h3>
            <p className="text-gray-600 mb-4">Tap the heart icon on Search results or profiles to build your shortlist.</p>
            <Link href="/search" className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
              Browse skills
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {favoriteUsers.map((fav) => {
              const userId = fav.id || fav._id?.toString();
              return (
                <div key={userId} className="bg-white rounded-lg shadow-sm border border-green-100 hover:border-green-300 transition">
                  <div className="p-4 flex items-center gap-4">
                    <img
                      src={fav.avatar?.url || `https://ui-avatars.com/api/?name=${encodeURIComponent(fav.name || 'U')}&background=0ea5e9&color=fff&size=128&bold=true`}
                      alt={fav.name}
                      className="h-16 w-16 rounded-full object-cover ring-2 ring-green-500/50"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-gray-900 truncate">{fav.name}</h3>
                        <button
                          onClick={() => handleRemove(userId, fav.name)}
                          className="text-sm text-red-500 hover:text-red-600"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
                        <span>⭐ {fav.rating?.average?.toFixed?.(1) || Number(fav.rating?.average || 0).toFixed(1)} ({fav.rating?.count || 0})</span>
                        <span>⏱️ {fav.credits || 0} credits</span>
                      </div>
                      {fav.skillsOffered?.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {fav.skillsOffered.slice(0, 3).map((skill, idx) => (
                            <span key={idx} className="bg-green-50 text-green-700 text-xs px-2 py-1 rounded-full border border-green-200">
                              {skill.name}
                            </span>
                          ))}
                          {fav.skillsOffered.length > 3 && (
                            <span className="text-xs text-gray-400">+{fav.skillsOffered.length - 3} more</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-4 pb-4 flex flex-wrap gap-2">
                    <Link href={`/profile/${userId}`} className="flex-1 min-w-[140px] text-center px-3 py-2 border border-green-600 text-green-600 rounded hover:bg-green-50">
                      View profile
                    </Link>
                    <button
                      onClick={() => handleStartChat(fav)}
                      className="flex-1 min-w-[140px] px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      Message
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
