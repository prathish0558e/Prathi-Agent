import { useState } from 'react';
import { BottomNav } from '../components/BottomNav';
import UniversityTracker from '../components/UniversityTracker';
import ApplicationTracker from '../components/ApplicationTracker';
import DocumentVault from '../components/DocumentVault';
import { AdmissionFinder } from '../components/AdmissionFinder';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { GraduationCap, FileText, Calendar, Search } from 'lucide-react';

export function UniversityAdmission() {
  const [activeTab, setActiveTab] = useState('universities');

  return (
    <div className="app-shell pb-24">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8 bg-card border border-border/70">
            <TabsTrigger value="universities" className="gap-2">
              <GraduationCap size={16} />
              Universities
            </TabsTrigger>
            <TabsTrigger value="applications" className="gap-2">
              <Calendar size={16} />
              Applications
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-2">
              <FileText size={16} />
              Documents
            </TabsTrigger>
            <TabsTrigger value="finder" className="gap-2">
              <Search size={16} />
              Admissions Finder
            </TabsTrigger>
          </TabsList>

          <TabsContent value="universities" className="mt-6">
            <UniversityTracker />
          </TabsContent>

          <TabsContent value="applications" className="mt-6">
            <ApplicationTracker />
          </TabsContent>

          <TabsContent value="documents" className="mt-6">
            <DocumentVault />
          </TabsContent>

          <TabsContent value="finder" className="mt-6">
            <AdmissionFinder />
          </TabsContent>
        </Tabs>
      </div>

      <BottomNav />
    </div>
  );
}
