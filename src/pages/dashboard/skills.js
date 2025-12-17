import { useMemo, useState } from 'react';

import { useAuth, useRequireAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import PageHeader from '../../components/ui/PageHeader';
import InteractiveCard from '../../components/ui/InteractiveCard';
import GradientPill from '../../components/ui/GradientPill';
import LoadingSpinner from '../../components/ui/LoadingSpinner';
import { Button } from '../../components/ui/Button';

export default function SkillsManagement() {
  const { user, updateUser } = useAuth();
  useRequireAuth();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [newSkill, setNewSkill] = useState({
    name: '',
    category: 'home',
    description: '',
    experience: 'intermediate'
  });

  const categories = useMemo(() => ([
    { value: 'home', label: 'Home & Garden' },
    { value: 'tech', label: 'Technology' },
    { value: 'creative', label: 'Creative' },
    { value: 'education', label: 'Education' },
    { value: 'health', label: 'Health & Wellness' },
    { value: 'other', label: 'Other' }
  ]), []);

  const addSkill = async (type) => {
    if (!newSkill.name.trim()) {
      addToast({ type: 'warning', title: 'Add a skill name', message: 'Give your skill a short title before saving.' });
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/users/skills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          type,
          skill: newSkill
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        updateUser(data.user);
        addToast({ type: 'success', title: type === 'offered' ? 'Skill added to offerings' : 'Skill added to wish list' });
        setNewSkill({
          name: '',
          category: 'home',
          description: '',
          experience: 'intermediate'
        });
      } else {
        addToast({ type: 'error', title: 'Could not add skill', message: data.message });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Something went wrong', message: 'Please try again in a moment.' });
    }
    setLoading(false);
  };

  const removeSkill = async (type, skillId) => {
    if (!confirm('Are you sure you want to remove this skill?')) return;

    setLoading(true);
    try {
      const response = await fetch('/api/users/skills', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ type, skillId })
      });

      const data = await response.json();
      
      if (response.ok) {
        updateUser(data.user);
        addToast({ type: 'success', title: 'Skill removed' });
      } else {
        addToast({ type: 'error', title: 'Could not remove skill', message: data.message });
      }
    } catch (error) {
      addToast({ type: 'error', title: 'Error removing skill', message: 'Please try again.' });
    }
    setLoading(false);
  };

  if (!user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <LoadingSpinner size="large" />
        <p className="text-sm text-slate-500 dark:text-slate-300">Loading your skills library…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 px-4 pb-16 pt-10 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Skills"
        title="Curate your swap toolkit"
        subtitle="Showcase what you can teach and list the talents you're hunting for—balanced profiles match faster."
      />

      <InteractiveCard className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-2">
            <GradientPill>Add a new skill</GradientPill>
            <p className="text-sm text-slate-500 dark:text-slate-300">Give it a name, pick a category, and share a detail or two so neighbors know exactly how you can help.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Skill name
            </label>
            <input
              type="text"
              value={newSkill.name}
              onChange={(e) => setNewSkill({ ...newSkill, name: e.target.value })}
              className="input-field"
              placeholder="e.g., Bike repair, UX mentoring"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Category
            </label>
            <select
              value={newSkill.category}
              onChange={(e) => setNewSkill({ ...newSkill, category: e.target.value })}
              className="input-field"
            >
              {categories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Experience level
            </label>
            <select
              value={newSkill.experience}
              onChange={(e) => setNewSkill({ ...newSkill, experience: e.target.value })}
              className="input-field"
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
              <option value="expert">Expert</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500 dark:text-slate-300">
              Description
            </label>
            <input
              type="text"
              value={newSkill.description}
              onChange={(e) => setNewSkill({ ...newSkill, description: e.target.value })}
              className="input-field"
              placeholder="Share how you deliver this skill in a sentence"
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            onClick={() => addSkill('offered')}
            loading={loading}
            disabled={loading}
          >
            Add to skills I offer
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => addSkill('needed')}
            disabled={loading}
          >
            Add to skills I need
          </Button>
        </div>
      </InteractiveCard>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <InteractiveCard className="h-full space-y-4">
          <div className="flex items-center justify-between">
            <GradientPill>Skills I offer</GradientPill>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">{user.skillsOffered?.length || 0}</span>
          </div>
          {user?.skillsOffered?.length ? (
            <div className="space-y-4">
              {user.skillsOffered.map((skill) => (
                <div key={skill._id} className="flex flex-col gap-3 rounded-2xl border border-soft surface-muted p-4 shadow-inner transition sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{skill.name}</h3>
                    {skill.description && <p className="text-sm text-slate-500 dark:text-slate-300">{skill.description}</p>}
                    <span className="inline-flex items-center rounded-full bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-sky-600 dark:bg-sky-500/20 dark:text-sky-200">
                      {skill.experience}
                    </span>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border-rose-300/50 text-rose-500 hover:border-rose-400 hover:text-rose-600 dark:border-rose-500/30 dark:text-rose-200"
                    onClick={() => removeSkill('offered', skill._id)}
                    disabled={loading}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-soft bg-[rgba(var(--panel),0.45)] p-6 text-sm text-muted">
              No offerings yet. Add a skill above to showcase your talents.
            </div>
          )}
        </InteractiveCard>

        <InteractiveCard className="h-full space-y-4">
          <div className="flex items-center justify-between">
            <GradientPill>Skills I need</GradientPill>
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400 dark:text-slate-500">{user.skillsNeeded?.length || 0}</span>
          </div>
          {user?.skillsNeeded?.length ? (
            <div className="space-y-4">
              {user.skillsNeeded.map((skill) => (
                <div key={skill._id} className="flex flex-col gap-3 rounded-2xl border border-soft surface-muted p-4 shadow-inner transition sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-2">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100">{skill.name}</h3>
                    {skill.description && <p className="text-sm text-slate-500 dark:text-slate-300">{skill.description}</p>}
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    className="border-rose-300/50 text-rose-500 hover:border-rose-400 hover:text-rose-600 dark:border-rose-500/30 dark:text-rose-200"
                    onClick={() => removeSkill('needed', skill._id)}
                    disabled={loading}
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-soft bg-[rgba(var(--panel),0.45)] p-6 text-sm text-muted">
              No wish-list items yet. Add a skill you&apos;d love to learn to inspire matches.
            </div>
          )}
        </InteractiveCard>
      </div>
    </div>
  );
}