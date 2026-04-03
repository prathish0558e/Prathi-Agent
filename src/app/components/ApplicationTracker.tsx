import { useState, useEffect } from 'react';
import { Plus, Calendar, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { useAuth } from '../auth/AuthContext';
import { getApplications, getUniversities } from '../lib/universityDb';
import type { Application, University } from '../types/university';
import CreateApplicationModal from './CreateApplicationModal';

export default function ApplicationTracker() {
  const { email } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [universities, setUniversities] = useState<Map<string, University>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (!email) return;

    const loadData = async () => {
      try {
        setIsLoading(true);
        const [appData, uniData] = await Promise.all([
          getApplications(email),
          getUniversities(email),
        ]);

        setApplications(appData);
        const uniMap = new Map(uniData.map((uni) => [uni.id, uni]));
        setUniversities(uniMap);
      } catch (error) {
        console.error('Failed to load applications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [email]);

  const getStatusIcon = (status: Application['status']) => {
    switch (status) {
      case 'accepted':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'rejected':
        return <XCircle className="text-red-600" size={20} />;
      case 'submitted':
        return <Calendar className="text-blue-600" size={20} />;
      case 'waitlisted':
        return <Clock className="text-yellow-600" size={20} />;
      default:
        return <AlertCircle className="text-gray-600" size={20} />;
    }
  };

  const getStatusColor = (status: Application['status']) => {
    switch (status) {
      case 'accepted':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'submitted':
        return 'bg-blue-100 text-blue-800';
      case 'waitlisted':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredApplications =
    filterStatus === 'all'
      ? applications
      : applications.filter((app) => app.status === filterStatus);

  const stats = {
    total: applications.length,
    submitted: applications.filter((a) => a.status === 'submitted').length,
    accepted: applications.filter((a) => a.status === 'accepted').length,
    rejected: applications.filter((a) => a.status === 'rejected').length,
    pending: applications.filter((a) => a.status === 'pending').length,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold">Applications</h2>
          <p className="text-gray-600 mt-1">Track your application status</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)} className="gap-2">
          <Plus size={20} />
          New Application
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'bg-blue-50' },
          { label: 'Pending', value: stats.pending, color: 'bg-gray-50' },
          { label: 'Submitted', value: stats.submitted, color: 'bg-purple-50' },
          { label: 'Accepted', value: stats.accepted, color: 'bg-green-50' },
          { label: 'Rejected', value: stats.rejected, color: 'bg-red-50' },
        ].map((stat) => (
          <Card key={stat.label} className={stat.color}>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {['all', 'pending', 'submitted', 'accepted', 'rejected', 'waitlisted'].map((status) => (
          <Button
            key={status}
            variant={filterStatus === status ? 'default' : 'outline'}
            onClick={() => setFilterStatus(status)}
            className="capitalize"
          >
            {status}
          </Button>
        ))}
      </div>

      {/* Applications List */}
      {isLoading ? (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredApplications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle size={40} className="text-gray-400 mb-4" />
            <p className="text-gray-600 mb-4">No applications yet</p>
            <Button variant="outline">Create Your First Application</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredApplications.map((application) => {
            const university = universities.get(application.university_id);
            return (
              <Card key={application.id} className="hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 flex-1">
                      {getStatusIcon(application.status)}
                      <div className="flex-1">
                        <h3 className="font-semibold">
                          {university?.name || 'Unknown University'}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Applied: {new Date(application.application_date).toLocaleDateString()}
                        </p>
                        {application.notes && (
                          <p className="text-sm text-gray-600 mt-1">{application.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge className={getStatusColor(application.status)}>
                        {application.status}
                      </Badge>
                      {application.decision_date && (
                        <p className="text-xs text-gray-600">
                          Decided: {new Date(application.decision_date).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateApplicationModal
          onSuccess={(newApp) => {
            setApplications([newApp, ...applications]);
            setShowCreateModal(false);
          }}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}
