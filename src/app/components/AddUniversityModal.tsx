import { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../auth/AuthContext';
import { createUniversity, updateUniversity } from '../lib/universityDb';
import type { University } from '../types/university';

interface AddUniversityModalProps {
  university?: University | null;
  onSuccess: (university: University) => void;
  onClose: () => void;
}

export default function AddUniversityModal({
  university,
  onSuccess,
  onClose,
}: AddUniversityModalProps) {
  const { email } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: university?.name || '',
    country: university?.country || '',
    state: university?.state || '',
    ranking: university?.ranking?.toString() || '',
    acceptance_rate: university?.acceptance_rate?.toString() || '',
    website: university?.website || '',
    courses: university?.courses?.join(', ') || '',
    program_level: university?.program_level || '',
    admission_deadline: university?.admission_deadline || '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.name.trim() || !formData.country.trim()) {
      setError('University name and country are required');
      return;
    }

    try {
      setIsLoading(true);

      const courseList = formData.courses
        .split(',')
        .map((course) => course.trim())
        .filter(Boolean);

      const universityData = {
        name: formData.name.trim(),
        country: formData.country.trim(),
        state: formData.state.trim() || undefined,
        ranking: formData.ranking ? parseInt(formData.ranking, 10) : undefined,
        acceptance_rate: formData.acceptance_rate ? parseFloat(formData.acceptance_rate) : undefined,
        website: formData.website.trim() || undefined,
        courses: courseList.length > 0 ? courseList : undefined,
        program_level: formData.program_level || undefined,
        admission_deadline: formData.admission_deadline || undefined,
        user_id: email || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      if (university) {
        const updated = await updateUniversity(university.id, universityData);
        onSuccess(updated);
      } else {
        const created = await createUniversity(universityData);
        onSuccess(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save university');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 px-4">
      <div className="app-surface text-foreground max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b border-border/70">
          <h2 className="text-xl font-bold">
            {university ? 'Edit University' : 'Add University'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-secondary rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-500/10 border border-red-500/30 text-red-700 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="name" className="block text-sm font-medium mb-1">
              University Name *
            </Label>
            <Input
              id="name"
              placeholder="e.g., Harvard University"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              disabled={isLoading}
              className="bg-input-background border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="country" className="block text-sm font-medium mb-1">
                Country *
              </Label>
              <Input
                id="country"
                placeholder="e.g., USA"
                value={formData.country}
                onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                disabled={isLoading}
                className="bg-input-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <Label htmlFor="state" className="block text-sm font-medium mb-1">
                State/Province
              </Label>
              <Input
                id="state"
                placeholder="e.g., Massachusetts"
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                disabled={isLoading}
                className="bg-input-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ranking" className="block text-sm font-medium mb-1">
                Ranking
              </Label>
              <Input
                id="ranking"
                type="number"
                placeholder="e.g., 1"
                value={formData.ranking}
                onChange={(e) => setFormData({ ...formData, ranking: e.target.value })}
                disabled={isLoading}
                className="bg-input-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <Label htmlFor="acceptance_rate" className="block text-sm font-medium mb-1">
                Acceptance Rate (%)
              </Label>
              <Input
                id="acceptance_rate"
                type="number"
                placeholder="e.g., 5.5"
                step="0.1"
                value={formData.acceptance_rate}
                onChange={(e) => setFormData({ ...formData, acceptance_rate: e.target.value })}
                disabled={isLoading}
                className="bg-input-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="program_level" className="block text-sm font-medium mb-1">
                Program Level
              </Label>
              <select
                id="program_level"
                value={formData.program_level}
                onChange={(e) => setFormData({ ...formData, program_level: e.target.value })}
                disabled={isLoading}
                className="h-10 w-full rounded-md bg-input-background border border-border px-3 text-sm text-foreground"
              >
                <option value="">Select level</option>
                <option value="bachelors">Bachelors</option>
                <option value="masters">Masters</option>
                <option value="phd">PhD</option>
                <option value="diploma">Diploma</option>
                <option value="certificate">Certificate</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <Label htmlFor="admission_deadline" className="block text-sm font-medium mb-1">
                Admission Deadline
              </Label>
              <Input
                id="admission_deadline"
                type="date"
                value={formData.admission_deadline}
                onChange={(e) => setFormData({ ...formData, admission_deadline: e.target.value })}
                disabled={isLoading}
                className="bg-input-background border-border text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="courses" className="block text-sm font-medium mb-1">
              Courses (comma separated)
            </Label>
            <Input
              id="courses"
              placeholder="e.g., Computer Science, Data Science, MBA"
              value={formData.courses}
              onChange={(e) => setFormData({ ...formData, courses: e.target.value })}
              disabled={isLoading}
              className="bg-input-background border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div>
            <Label htmlFor="website" className="block text-sm font-medium mb-1">
              Website URL
            </Label>
            <Input
              id="website"
              type="url"
              placeholder="https://example.com"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              disabled={isLoading}
              className="bg-input-background border-border text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading} className="flex-1">
              {isLoading ? 'Saving...' : 'Save University'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
