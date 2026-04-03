import { useState, useEffect } from 'react';
import { Upload, FileText, Trash2, Download } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { useAuth } from '../auth/AuthContext';
import { getApplications, getApplicationDocuments, deleteDocument, uploadDocument } from '../lib/universityDb';
import { getSupabaseClient } from '../lib/supabaseClient';
import type { Application, Document } from '../types/university';

export default function DocumentVault() {
  const { email } = useAuth();
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<string>('');
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!email) return;

    const loadApplications = async () => {
      try {
        setIsLoading(true);
        const appData = await getApplications(email);
        setApplications(appData);
        if (appData.length > 0) {
          setSelectedApplication(appData[0].id);
        }
      } catch (error) {
        console.error('Failed to load applications:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadApplications();
  }, [email]);

  useEffect(() => {
    if (!selectedApplication) return;

    const loadDocuments = async () => {
      try {
        const docData = await getApplicationDocuments(selectedApplication);
        setDocuments(docData);
      } catch (error) {
        console.error('Failed to load documents:', error);
      }
    };

    loadDocuments();
  }, [selectedApplication]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !selectedApplication) return;

    setIsUploading(true);

    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      for (const file of Array.from(files)) {
        const fileName = `${Date.now()}-${file.name}`;
        const filePath = `${email}/${selectedApplication}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from('application-documents')
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Add to database
        const created = await uploadDocument({
          id: crypto.randomUUID(),
          application_id: selectedApplication,
          doc_type: 'other',
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
        });

        setDocuments((previous) => [created, ...previous]);
      }
    } catch (error) {
      console.error('Failed to upload file:', error);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const supabase = getSupabaseClient();
      if (!supabase) throw new Error('Supabase not configured');

      const { data, error } = await supabase.storage
        .from('application-documents')
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const link = window.document.createElement('a');
      link.href = url;
      link.download = doc.file_name;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download file:', error);
    }
  };

  const handleDelete = async (documentId: string, filePath: string) => {
    if (confirm('Are you sure you want to delete this document?')) {
      try {
        await deleteDocument(documentId, filePath);
        setDocuments(documents.filter((doc) => doc.id !== documentId));
      } catch (error) {
        console.error('Failed to delete document:', error);
      }
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold">Document Vault</h2>
        <p className="text-gray-600 mt-1">Store and manage your application documents</p>
      </div>

      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-gray-600 mb-4">No applications yet. Create one to store documents.</p>
            <Button variant="outline">Create Your First Application</Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="flex gap-4 items-center">
            <label className="flex-1">
              <span className="block text-sm font-medium mb-2">Select Application</span>
              <select
                value={selectedApplication}
                onChange={(e) => setSelectedApplication(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    Application {new Date(app.created_at).toLocaleDateString()}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex-1 mt-6">
              <input
                id="file-upload"
                type="file"
                multiple
                onChange={handleFileUpload}
                disabled={isUploading}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.xls,.xlsx"
              />
              <label htmlFor="file-upload">
                <Button className="w-full gap-2" disabled={isUploading} asChild>
                  <span className="cursor-pointer">
                    <Upload size={20} />
                    Upload Documents
                  </span>
                </Button>
              </label>
            </div>
          </div>

          {documents.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText size={40} className="text-gray-400 mb-4" />
                <p className="text-gray-600">No documents uploaded yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Documents ({documents.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        <FileText size={20} className="text-blue-600" />
                        <div className="flex-1">
                          <p className="font-medium">{doc.file_name}</p>
                          <p className="text-sm text-gray-600">
                            {formatFileSize(doc.file_size)} • Uploaded{' '}
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDownload(doc)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Download"
                        >
                          <Download size={16} className="text-green-600" />
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id, doc.file_path)}
                          className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} className="text-red-600" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
