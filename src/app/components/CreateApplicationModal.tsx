import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../auth/AuthContext';
import { createApplication, getUniversities } from '../lib/universityDb';
import type { Application, University } from '../types/university';

interface CreateApplicationModalProps {
  onSuccess: (application: Application) => void;
  onClose: () => void;
}

export default function CreateApplicationModal({
  onSuccess,
  onClose,
}: CreateApplicationModalProps) {
  const { email } = useAuth();
  const [universities, setUniversities] = useState<University[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    university_id: '',
    application_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  useEffect(() => {
    if (!email) return;

    const loadUniversities = async () => {
      try {
        const data = await getUniversities(email);
        setUniversities(data);
        if (data.length > 0) {
          setFormData(prev => ({ ...prev, university_id: data[0].id }));
        }
      } catch (err) {
        setError('Failed to load universities');
      } finally {
        setIsLoading(false);
      }
    };

    loadUniversities();
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.university_id) {
      setError('Please select a university');
      return;
    }

    try {
      setIsSubmitting(true);

      const application: Application = {
        id: crypto.randomUUID(),
        user_id: email || '',
        university_id: formData.university_id,
        status: 'pending',
        application_date: formData.application_date,
        notes: formData.notes || undefined,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const created = await createApplication(application);
      onSuccess(created);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create application');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 p-6">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  if (universities.length === 0) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="flex justify-between items-center p-6 border-b">
            <h2 className="text-xl font-bold">Create Application</h2>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-6 text-center">
            <p className="text-gray-600 mb-4">
              You need to add a university first before creating an application.
            </p>
            <Button onClick={onClose} variant="outline" className="w-full">
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-bold">Create Application</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-2 rounded">
              {error}
            </div>
          )}

          <div>
            <Label htmlFor="university" className="block text-sm font-medium mb-1">
              University *
            </Label>
            <select
              id="university"
              value={formData.university_id}
              onChange={(e) => setFormData({ ...formData, university_id: e.target.value })}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {universities.map((uni) => (
                <option key={uni.id} value={uni.id}>
                  {uni.name} ({uni.country})
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label htmlFor="date" className="block text-sm font-medium mb-1">
              Application Date
            </Label>
            <Input
              id="date"
              type="date"
              value={formData.application_date}
              onChange={(e) => setFormData({ ...formData, application_date: e.target.value })}
              disabled={isSubmitting}
            />
          </div>

          <div>
            <Label htmlFor="notes" className="block text-sm font-medium mb-1">
              Notes
            </Label>
            <textarea
              id="notes"
              placeholder="Any additional notes..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              disabled={isSubmitting}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Creating...' : 'Create Application'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
