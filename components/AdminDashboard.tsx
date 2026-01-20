
import React, { useEffect, useState } from 'react';
import { fetchAdminReports, AssessmentResult, subscribeToAssessmentUpdates } from '../services/supabaseClient';
import { 
  X, RefreshCw, Search, Trophy, CheckCircle2, Clock, Download, 
  AlertTriangle, Database, User, ChevronRight, BarChart3, 
  Calendar, Globe, TrendingUp, Sparkles, AlertCircle, Activity,
  BrainCircuit, GraduationCap, Target
} from 'lucide-react';

interface AdminDashboardProps {
  onClose: () => void;
}

// --- Components ---

const StatCard = ({ title, value, icon: Icon, colorClass, subtext }: any) => (
  <div className="bg-slate-800/50 backdrop-blur-sm border border-white/5 rounded-2xl p-5 flex items-start justify-between relative overflow-hidden group hover:border-white/10 transition-all">
    <div className={`absolute top-0 right-0 p-24 rounded-full opacity-5 group-hover:opacity-10 transition-opacity ${colorClass.replace('text-', 'bg-')}`} />
    <div>
      <p className="text-slate-400 text-xs uppercase tracking-wider font-semibold mb-1">{title}</p>
      <h3 className="text-3xl font-bold text-white mb-1">{value}</h3>
      {subtext && <p className="text-xs text-slate-500">{subtext}</p>}
    </div>
    <div className={`p-3 rounded-xl ${colorClass.replace('text-', 'bg-').replace('400', '500/10')} ${colorClass}`}>
      <Icon size={24} />
    </div>
  </div>
);

const ScoreGauge = ({ score }: { score: number }) => {
  const radius = 50;
  const stroke = 8;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  let color = 'stroke-indigo-500';
  if (score >= 80) color = 'stroke-emerald-500';
  if (score >= 100) color = 'stroke-amber-400';

  return (
    <div className="relative flex items-center justify-center">
      <svg height={radius * 2} width={radius * 2} className="rotate-[-90deg]">
        <circle
          stroke="rgba(255,255,255,0.1)"
          strokeWidth={stroke}
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          className={`${color} transition-all duration-1000 ease-out`}
          strokeWidth={stroke}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset }}
          strokeLinecap="round"
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-3xl font-bold text-white">{score}%</span>
        <span className="text-[10px] uppercase text-slate-500 font-bold tracking-wider">Mastery</span>
      </div>
    </div>
  );
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [reports, setReports] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedAgent, setSelectedAgent] = useState<AssessmentResult | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminReports();
      setReports(data);
    } catch (err: any) {
      if (err.message === "MISSING_TABLES") {
        setError("MISSING_TABLES");
      } else {
        setError(err.message || "Failed to load reports.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Setup Realtime Subscription
    const subscription = subscribeToAssessmentUpdates((payload) => {
       // Helper to sort by updated_at descending
       const sortByDate = (list: AssessmentResult[]) => {
         return [...list].sort((a, b) => {
            const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
            const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
            return dateB - dateA;
         });
       };

       if (payload.eventType === 'INSERT') {
         setReports(prev => sortByDate([payload.new, ...prev]));
       } 
       else if (payload.eventType === 'UPDATE') {
         setReports(prev => sortByDate(prev.map(item => item.id === payload.new.id ? payload.new : item)));
         
         // Update Detail View if selected agent is the one updated
         setSelectedAgent(current => (current && current.id === payload.new.id ? payload.new : current));
       } 
       else if (payload.eventType === 'DELETE') {
         setReports(prev => prev.filter(item => item.id !== payload.old.id));
         setSelectedAgent(current => (current && current.id === payload.old.id ? null : current));
       }
    });

    return () => {
      if (subscription && subscription.unsubscribe) {
        subscription.unsubscribe();
      }
    };
  }, []);

  // --- Calculations ---
  const filteredReports = reports.filter(r => 
    r.agent_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = {
    total: reports.length,
    certified: reports.filter(r => r.score >= 100).length,
    passed: reports.filter(r => r.score >= 80 && r.score < 100).length,
    avgScore: reports.length > 0 ? Math.round(reports.reduce((a, b) => a + b.score, 0) / reports.length) : 0,
  };

  // --- Handlers ---
  const handleExportCSV = () => {
    if (filteredReports.length === 0) return alert("No data to export");
    const headers = ["Agent Name", "Language", "Score", "Status", "Last Feedback", "Last Updated"];
    const rows = filteredReports.map(r => [
      `"${r.agent_name.replace(/"/g, '""')}"`,
      `"${r.language.toUpperCase()}"`,
      r.score,
      `"${r.score >= 80 ? 'Passed' : 'In Progress'}"`,
      `"${(r.last_feedback || '').replace(/"/g, '""')}"`,
      `"${r.updated_at || ''}"`
    ]);
    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `braintrade_report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Insight Logic ---
  const getCoachingAction = (feedback: string, score: number) => {
    if (score === 0) return "Initial onboarding needed. Ensure agent has accessed the Learning Portal.";
    if (score >= 100) return "Ready for mentor role. Can support junior agents.";
    
    const lowerFeedback = feedback.toLowerCase();
    
    if (lowerFeedback.includes("smartbrain") || lowerFeedback.includes("intro")) 
      return "Roleplay Opener: Focus on introducing SmartBrain AI before showing packages.";
    
    if (lowerFeedback.includes("package") || lowerFeedback.includes("price")) 
      return "Review Pricing: Quiz agent on the 6 packages and specifically the middle 'View Demo' pivot.";
      
    if (lowerFeedback.includes("demo") || lowerFeedback.includes("academy")) 
      return "Product Knowledge: Assign 'Demo Deep Dive' module. Agent must know the 7 sections.";
      
    if (lowerFeedback.includes("payment") || lowerFeedback.includes("deposit")) 
      return "Compliance Risk: Review the 'Backup Payment' policy. Ensure they know to try Standard first.";
      
    if (lowerFeedback.includes("risk") || lowerFeedback.includes("psychology")) 
      return "Sales Pitch: Agent missed the 'Risk Management' USP. This is key for handling 'I lost money before' objections.";
      
    return "General refresher on the Walkthrough Flow sequence required.";
  };

  return (
    <div className="flex h-screen bg-[#0f172a] text-slate-100 overflow-hidden font-sans">
      
      {/* Sidebar / Main Content Area */}
      <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${selectedAgent ? 'mr-[400px]' : ''}`}>
        
        {/* Top Header */}
        <div className="bg-slate-900/80 backdrop-blur-xl border-b border-white/5 p-6 flex justify-between items-center sticky top-0 z-20">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Trophy size={24} className="text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white tracking-tight">Command Center</h1>
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-medium">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Live Data Stream Active
              </div>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={handleExportCSV} className="hidden md:flex items-center gap-2 px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-medium transition-colors border border-white/5">
                <Download size={16} /> Export
             </button>
             <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-xl transition-colors">
               <X size={24} className="text-slate-400" />
             </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          
          {/* KPI Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard 
              title="Total Agents" 
              value={stats.total} 
              icon={User} 
              colorClass="text-indigo-400" 
              subtext="Registered in system"
            />
            <StatCard 
              title="Certified Experts" 
              value={stats.certified} 
              icon={Trophy} 
              colorClass="text-amber-400" 
              subtext="100% Mastery Score"
            />
            <StatCard 
              title="Passed" 
              value={stats.passed} 
              icon={CheckCircle2} 
              colorClass="text-emerald-400" 
              subtext="Score 80% - 99%"
            />
            <StatCard 
              title="Avg. Score" 
              value={`${stats.avgScore}%`} 
              icon={TrendingUp} 
              colorClass="text-purple-400" 
              subtext="Global Average"
            />
          </div>

          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-4 justify-between items-center mb-6">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input 
                type="text" 
                placeholder="Search agents..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-11 pr-4 py-3 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              />
            </div>
            <button 
              onClick={loadData}
              className="flex items-center gap-2 px-4 py-2 text-indigo-400 hover:bg-indigo-900/20 rounded-lg transition-colors text-sm font-medium"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              Refresh Data
            </button>
          </div>

          {/* Database Missing Error */}
          {error === "MISSING_TABLES" && (
            <div className="p-8 bg-slate-900 border border-indigo-500/30 rounded-2xl shadow-xl text-center">
               <Database size={48} className="mx-auto text-indigo-400 mb-4" />
               <h3 className="text-xl font-bold text-white mb-2">Setup Required</h3>
               <p className="text-slate-400 mb-6 max-w-md mx-auto">The database tables are missing. Please run the SQL setup script in Supabase.</p>
               <pre className="bg-black/30 p-4 rounded-xl text-left text-xs font-mono text-emerald-400 overflow-x-auto max-w-2xl mx-auto mb-6">
                 {`create table if not exists assessment_results (
  id bigint generated by default as identity primary key,
  agent_name text not null,
  score integer default 0,
  status text,
  language text,
  last_feedback text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now())
);`}
               </pre>
               <button onClick={loadData} className="px-6 py-2 bg-indigo-600 rounded-xl text-white font-medium hover:bg-indigo-500">
                 Retry Connection
               </button>
            </div>
          )}

          {/* Main List */}
          {error !== "MISSING_TABLES" && (
            <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-800/50 text-xs uppercase tracking-wider text-slate-400 border-b border-white/5">
                    <th className="p-5 font-semibold">Agent</th>
                    <th className="p-5 font-semibold">Language</th>
                    <th className="p-5 font-semibold">Latest Mistake/Feedback</th>
                    <th className="p-5 font-semibold text-right">Score</th>
                    <th className="p-5 font-semibold text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {loading ? (
                    <tr><td colSpan={5} className="p-10 text-center text-slate-500">Loading...</td></tr>
                  ) : filteredReports.length === 0 ? (
                    <tr><td colSpan={5} className="p-10 text-center text-slate-500">No results found</td></tr>
                  ) : (
                    filteredReports.map((report) => (
                      <tr 
                        key={report.id} 
                        onClick={() => setSelectedAgent(report)}
                        className={`cursor-pointer transition-colors group ${
                          selectedAgent?.id === report.id ? 'bg-indigo-900/20' : 'hover:bg-white/5'
                        }`}
                      >
                        <td className="p-5">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-indigo-300 font-bold text-sm border border-white/10">
                              {report.agent_name.substring(0,2).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-white">{report.agent_name}</div>
                              <div className="text-xs text-slate-500 flex items-center gap-1">
                                <Clock size={10} />
                                {report.updated_at ? new Date(report.updated_at).toLocaleDateString() : 'New'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-5">
                           <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 border border-white/5 text-xs text-slate-300 font-mono uppercase">
                             <Globe size={10} /> {report.language}
                           </span>
                        </td>
                        <td className="p-5">
                          <span className="text-sm text-slate-400 truncate block max-w-[200px]">
                            {report.last_feedback ? (
                              <span className="flex items-center gap-1 text-rose-400"><AlertCircle size={12}/> {report.last_feedback}</span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </span>
                        </td>
                        <td className="p-5 text-right">
                          <span className={`font-mono font-bold ${
                            report.score >= 80 ? 'text-emerald-400' : 'text-slate-400'
                          }`}>{report.score}%</span>
                        </td>
                        <td className="p-5 text-center">
                           <button className="p-2 rounded-full bg-slate-800 text-slate-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                             <ChevronRight size={16} />
                           </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Slide-over Detail Panel */}
      <div 
        className={`fixed inset-y-0 right-0 w-[400px] bg-slate-900 border-l border-white/10 shadow-2xl transform transition-transform duration-300 z-30 ${
          selectedAgent ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {selectedAgent ? (
          <div className="h-full flex flex-col">
            {/* Detail Header */}
            <div className="p-6 border-b border-white/5 bg-slate-900 relative">
              <button 
                onClick={() => setSelectedAgent(null)}
                className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg"
              >
                <X size={20} />
              </button>
              
              <div className="flex items-center gap-4 mb-4">
                 <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-700 border border-white/10 flex items-center justify-center shadow-inner">
                    <span className="text-2xl font-bold text-white tracking-wider">{selectedAgent.agent_name.substring(0,2).toUpperCase()}</span>
                 </div>
                 <div>
                   <h2 className="text-xl font-bold text-white">{selectedAgent.agent_name}</h2>
                   <p className="text-sm text-slate-400 flex items-center gap-1">
                     <span className={`w-2 h-2 rounded-full ${selectedAgent.score >= 80 ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                     {selectedAgent.score >= 80 ? 'Assessment Passed' : 'Needs Coaching'}
                   </p>
                 </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                 <div className="bg-slate-800/50 p-2 rounded-lg border border-white/5 flex items-center gap-2">
                    <Calendar size={14} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 uppercase">Started</span>
                      <span className="text-xs text-slate-200">
                        {selectedAgent.created_at ? new Date(selectedAgent.created_at).toLocaleDateString() : 'N/A'}
                      </span>
                    </div>
                 </div>
                 <div className="bg-slate-800/50 p-2 rounded-lg border border-white/5 flex items-center gap-2">
                    <Clock size={14} className="text-slate-400" />
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 uppercase">Last Update</span>
                      <span className="text-xs text-slate-200">
                         {selectedAgent.updated_at ? new Date(selectedAgent.updated_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
                      </span>
                    </div>
                 </div>
              </div>
            </div>

            {/* Detail Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
               
               {/* Score Card */}
               <div className="bg-slate-800/30 rounded-2xl p-6 border border-white/5 flex flex-col items-center">
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">Current Mastery Level</h3>
                  <ScoreGauge score={selectedAgent.score} />
               </div>

               {/* Feedback & Coaching Section (Enhanced) */}
               <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <BrainCircuit size={14} className="text-rose-400" /> Analysis & Mistakes
                  </h3>
                  
                  {/* Latest Feedback Block */}
                  <div className="bg-slate-800/50 p-4 rounded-xl border border-white/5 mb-4">
                     <span className="text-[10px] text-slate-500 uppercase tracking-wider font-bold block mb-2">Latest AI Feedback</span>
                     {selectedAgent.last_feedback ? (
                       <p className="text-sm text-rose-300 font-medium flex items-start gap-2">
                         <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                         "{selectedAgent.last_feedback}"
                       </p>
                     ) : (
                       <p className="text-sm text-slate-400 italic">No specific mistakes recorded yet.</p>
                     )}
                  </div>

                  {/* Coaching Advice Block */}
                  {selectedAgent.score < 100 && (
                    <div className="bg-indigo-900/20 p-4 rounded-xl border border-indigo-500/20">
                      <span className="text-[10px] text-indigo-400 uppercase tracking-wider font-bold block mb-2 flex items-center gap-1">
                         <GraduationCap size={12} /> Team Leader Coaching Plan
                      </span>
                      <p className="text-sm text-indigo-100 leading-relaxed">
                        {getCoachingAction(selectedAgent.last_feedback || '', selectedAgent.score)}
                      </p>
                    </div>
                  )}
               </div>

               {/* Module Checklist (Simulated based on score tiers) */}
               <div>
                  <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                    <Target size={14} /> Module Progress
                  </h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                       <span className="text-sm text-slate-300">SmartBrain & Introduction</span>
                       {selectedAgent.score > 20 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                       <span className="text-sm text-slate-300">Packages & Pivot Flow</span>
                       {selectedAgent.score > 40 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                       <span className="text-sm text-slate-300">Demo Deep Dive (7 Sections)</span>
                       {selectedAgent.score > 60 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                       <span className="text-sm text-slate-300">Payment & Reg Procedures</span>
                       {selectedAgent.score > 80 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                       <span className="text-sm text-slate-300">Objection Handling</span>
                       {selectedAgent.score >= 95 ? <CheckCircle2 size={16} className="text-emerald-500" /> : <div className="w-4 h-4 rounded-full border-2 border-slate-600" />}
                    </div>
                  </div>
               </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-white/5 bg-slate-900">
               <button className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-colors flex items-center justify-center gap-2">
                 <AlertTriangle size={16} className="text-amber-400" /> Flag for Review
               </button>
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-slate-500">
            Select an agent to view details
          </div>
        )}
      </div>

    </div>
  );
};
