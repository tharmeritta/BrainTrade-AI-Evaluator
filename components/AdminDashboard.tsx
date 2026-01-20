import React, { useEffect, useState } from 'react';
import { fetchAdminReports, AssessmentResult } from '../services/supabaseClient';
import { X, RefreshCw, Search, Trophy, CheckCircle2, Clock, Download, AlertTriangle, Database } from 'lucide-react';

interface AdminDashboardProps {
  onClose: () => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onClose }) => {
  const [reports, setReports] = useState<AssessmentResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAdminReports();
      setReports(data);
    } catch (err: any) {
      if (err.message === "MISSING_TABLES") {
        console.warn("Dashboard: Tables not found. Waiting for SQL setup.");
        setError("MISSING_TABLES");
      } else {
        console.error("Dashboard Load Error:", err.message || err);
        setError(err.message || "Failed to load reports.");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredReports = reports.filter(r => 
    r.agent_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleExportCSV = () => {
    if (filteredReports.length === 0) {
      alert("No data to export");
      return;
    }

    const headers = ["Agent Name", "Language", "Score", "Status", "Last Updated"];
    
    const rows = filteredReports.map(report => {
        const statusText = report.score >= 100 ? 'Certified Expert' : report.score >= 80 ? 'Passed' : 'In Progress';
        const dateText = report.updated_at ? new Date(report.updated_at).toLocaleString() : '-';
        
        return [
            `"${report.agent_name.replace(/"/g, '""')}"`, // Escape quotes
            `"${report.language.toUpperCase()}"`,
            report.score,
            `"${statusText}"`,
            `"${dateText}"`
        ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `braintrade_report_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string, score: number) => {
    if (score >= 100) return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    if (score >= 80) return 'text-teal-400 bg-teal-400/10 border-teal-400/20';
    return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
  };

  return (
    <div className="flex flex-col h-full bg-[#0f172a] text-slate-100">
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-b border-white/10 bg-slate-900/50 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Trophy size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Command Center</h2>
            <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Admin Dashboard</p>
          </div>
        </div>
        <button 
          onClick={onClose}
          className="p-2 hover:bg-white/10 rounded-lg transition-colors text-slate-400 hover:text-white"
        >
          <X size={24} />
        </button>
      </div>

      {/* Toolbar */}
      <div className="p-6 pb-2 flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search Agent Name..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-800/50 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm placeholder-slate-500"
          />
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <button 
            onClick={handleExportCSV}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-sm font-medium"
          >
            <Download size={16} />
            Export CSV
          </button>
          <button 
            onClick={loadData}
            className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95 text-sm font-medium"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Missing Tables Error (Special UI) */}
      {error === "MISSING_TABLES" && (
        <div className="m-6 p-6 bg-slate-900 border border-indigo-500/50 rounded-2xl shadow-xl">
           <div className="flex items-center gap-3 mb-4 text-indigo-300">
             <Database size={24} />
             <h3 className="text-lg font-bold text-white">Database Setup Required</h3>
           </div>
           <p className="text-slate-300 mb-4 leading-relaxed">
             The necessary tables were not found in your Supabase project. <br/>
             Please copy the SQL below and run it in your 
             <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 ml-1 underline">Supabase SQL Editor</a>.
           </p>
           <div className="relative bg-[#0d1117] rounded-xl border border-white/10 overflow-hidden">
             <div className="absolute top-3 right-3">
               <span className="text-xs text-slate-500 font-mono">SQL</span>
             </div>
             <pre className="p-4 text-xs sm:text-sm font-mono text-emerald-400 whitespace-pre overflow-x-auto custom-scrollbar">
{`create table if not exists assessment_results (
  id bigint generated by default as identity primary key,
  agent_name text not null,
  score integer default 0,
  status text,
  language text,
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

create table if not exists registrations (
  id bigint generated by default as identity primary key,
  name text,
  email text,
  phone text,
  created_at timestamp with time zone default timezone('utc'::text, now())
);`}
             </pre>
           </div>
           <button 
             onClick={loadData}
             className="mt-4 px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
           >
             I've run the SQL, try again
           </button>
        </div>
      )}

      {/* Generic Error Message */}
      {error && error !== "MISSING_TABLES" && (
        <div className="mx-6 mt-4 p-4 bg-red-900/20 border border-red-500/30 rounded-xl flex items-start gap-3 text-red-200">
           <AlertTriangle size={20} className="shrink-0 mt-0.5 text-red-400" />
           <div>
             <h3 className="font-bold text-red-400 text-sm mb-1">Database Error</h3>
             <p className="text-xs opacity-90">{error}</p>
           </div>
        </div>
      )}

      {/* Data Table (Only show if no missing tables error) */}
      {error !== "MISSING_TABLES" && (
        <div className="flex-1 overflow-auto p-6">
          <div className="bg-slate-900/50 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/5 border-b border-white/5 text-xs uppercase tracking-wider text-slate-400">
                  <th className="p-4 font-semibold">Agent Name</th>
                  <th className="p-4 font-semibold">Language</th>
                  <th className="p-4 font-semibold text-center">Score</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold text-right">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      <div className="flex justify-center items-center gap-2">
                        <RefreshCw className="animate-spin" size={20} /> Loading reports...
                      </div>
                    </td>
                  </tr>
                ) : filteredReports.length === 0 && !error ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-500">No agent records found.</td>
                  </tr>
                ) : filteredReports.length > 0 ? (
                  filteredReports.map((report) => (
                    <tr key={report.id} className="hover:bg-white/5 transition-colors group">
                      <td className="p-4">
                        <div className="font-medium text-white group-hover:text-indigo-300 transition-colors">{report.agent_name}</div>
                      </td>
                      <td className="p-4">
                        <span className="text-xs font-mono bg-slate-800 px-2 py-1 rounded text-slate-300 border border-white/5">
                          {report.language.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span className={`text-lg font-bold ${report.score >= 80 ? 'text-emerald-400' : 'text-slate-200'}`}>
                            {report.score}%
                          </span>
                          <div className="w-16 h-1 bg-slate-800 rounded-full mt-1 overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${report.score >= 80 ? 'bg-emerald-500' : 'bg-indigo-500'}`} 
                              style={{ width: `${report.score}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${getStatusColor(report.status, report.score)}`}>
                          {report.score >= 100 ? <Trophy size={12} /> : report.score >= 80 ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                          {report.score >= 100 ? 'Certified Expert' : report.score >= 80 ? 'Passed' : 'In Progress'}
                        </span>
                      </td>
                      <td className="p-4 text-right text-sm text-slate-400 font-mono">
                        {report.updated_at ? new Date(report.updated_at).toLocaleString() : '-'}
                      </td>
                    </tr>
                  ))
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};