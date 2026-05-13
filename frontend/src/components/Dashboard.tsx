import { useEffect, useState, useCallback } from 'react';
import {
  Activity, Server, Play, CheckCircle2, GitBranch, GitCommit,
  Zap, Clock, Shield, Box, AlertTriangle, ArrowUpRight, Layers,
  FileText, User, ChevronDown, ChevronRight, FolderGit2
} from 'lucide-react';

interface SchedulerStats {
  queue_depth: number;
  running_count: number;
  completed_total: number;
  active_pipelines: number;
  branch_distribution: Record<string, number>;
  priority_queue: any[];
  running_jobs: any[];
}

const BRANCH_COLORS: Record<string, string> = {
  main: '#4ade80',
  master: '#4ade80',
  develop: '#60a5fa',
  staging: '#fbbf24',
  'feature/oauth2-integration': '#a78bfa',
  'hotfix/critical-fix': '#ef4444',
};

const JOBTYPE_ICONS: Record<string, any> = {
  build: Box,
  test: CheckCircle2,
  deploy: ArrowUpRight,
  lint: Layers,
  security: Shield,
};

function getBranchColor(branch: string): string {
  if (BRANCH_COLORS[branch]) return BRANCH_COLORS[branch];
  if (branch.startsWith('hotfix')) return '#ef4444';
  if (branch.startsWith('feature')) return '#a78bfa';
  if (branch.startsWith('release')) return '#fb923c';
  if (branch.startsWith('bugfix')) return '#f472b6';
  return '#94a3b8';
}

function getRepoShort(url: string | null): string {
  if (!url) return 'unknown';
  return url.split('/').pop()?.replace('.git', '') || 'unknown';
}

function getRepoOrg(url: string | null): string {
  if (!url) return '';
  const parts = url.replace('.git', '').split('/');
  return parts.length >= 2 ? parts[parts.length - 2] + '/' + parts[parts.length - 1] : parts[parts.length - 1];
}

function getFileIcon(filePath: string): string {
  if (filePath.endsWith('.py')) return '🐍';
  if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) return '📘';
  if (filePath.endsWith('.js') || filePath.endsWith('.jsx')) return '📒';
  if (filePath.endsWith('.css')) return '🎨';
  if (filePath.endsWith('.yaml') || filePath.endsWith('.yml')) return '⚙️';
  if (filePath.endsWith('.json')) return '📋';
  if (filePath.endsWith('.md')) return '📄';
  if (filePath.includes('test')) return '🧪';
  return '📁';
}

function FileChangesList({ files, repoUrl }: { files: string[] | null; repoUrl: string | null }) {
  const [expanded, setExpanded] = useState(false);
  if (!files || files.length === 0) return null;
  const repo = getRepoOrg(repoUrl);
  return (
    <div style={{ marginTop: 6 }}>
      <button onClick={() => setExpanded(!expanded)} style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 6, padding: '4px 10px', cursor: 'pointer', display: 'flex',
        alignItems: 'center', gap: 5, fontSize: '0.7rem', color: '#94a3b8',
        fontFamily: 'Outfit, sans-serif', width: '100%', transition: 'all 0.15s',
      }}>
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        <FileText size={10} />
        <span style={{ color: '#e2e8f0', fontWeight: 600 }}>{files.length} file{files.length !== 1 ? 's' : ''} changed</span>
        {repo && <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.65rem' }}>{repo}</span>}
      </button>
      {expanded && (
        <div style={{
          marginTop: 4, padding: '6px 0', borderRadius: 6,
          background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.04)',
          maxHeight: 150, overflowY: 'auto', animation: 'slideIn 0.2s ease-out',
        }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '3px 10px',
              fontSize: '0.68rem', fontFamily: 'monospace', color: '#cbd5e1',
              borderBottom: i < files.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            }}>
              <span style={{ flexShrink: 0 }}>{getFileIcon(f)}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PriorityBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.72rem' }}>
      <span style={{ width: 52, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600, flexShrink: 0 }}>{label}</span>
      <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 3, transition: 'width 0.6s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: `0 0 8px ${color}40`,
        }} />
      </div>
      <span style={{ width: 36, textAlign: 'right', fontFamily: 'monospace', color, fontWeight: 600 }}>{value.toFixed(1)}</span>
    </div>
  );
}

export function Dashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [activeExecutions, setActiveExecutions] = useState<any[]>([]);
  const [stats, setStats] = useState<SchedulerStats | null>(null);

  useEffect(() => {
    const evtSource = new EventSource('http://localhost:8100/api/events');
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEvents(prev => [data, ...prev].slice(0, 50));
    };
    return () => evtSource.close();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [execRes, statsRes] = await Promise.all([
        fetch('http://localhost:8100/api/executions?limit=8'),
        fetch('http://localhost:8100/api/scheduler/stats'),
      ]);
      const execs = await execRes.json();
      const statsData = await statsRes.json();
      setStats(statsData);

      const detailedExecs = await Promise.all(
        execs.slice(0, 5).map(async (ex: any) => {
          const detailRes = await fetch(`http://localhost:8100/api/executions/${ex.id}`);
          return detailRes.json();
        })
      );
      setActiveExecutions(detailedExecs);
    } catch (err) {
      console.error("Failed to fetch", err);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2500);
    return () => clearInterval(interval);
  }, [fetchData]);

  return (
    <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20, width: '100%', overflowY: 'auto', background: 'transparent' }}>
      {/* ── Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 16 }}>
        <StatCard icon={<Activity size={18} />} iconBg="rgba(74,222,128,0.1)" iconColor="#4ade80" label="System Status" value="Healthy" />
        <StatCard icon={<Server size={18} />} iconBg="rgba(96,165,250,0.1)" iconColor="#60a5fa" label="Active Workers" value="4 / 4" />
        <StatCard icon={<Zap size={18} />} iconBg="rgba(251,191,36,0.1)" iconColor="#fbbf24" label="Queue Depth" value={String(stats?.queue_depth ?? 0)} />
        <StatCard icon={<Play size={18} />} iconBg="rgba(167,139,250,0.1)" iconColor="#a78bfa" label="Running Now" value={String(stats?.running_count ?? 0)} />
        <StatCard icon={<CheckCircle2 size={18} />} iconBg="rgba(16,185,129,0.1)" iconColor="#10b981" label="Total Completed" value={String(stats?.completed_total ?? 0)} />
      </div>

      {/* ── Priority Queue + Execution Visualizer ── */}
      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 0 }}>
        {/* Left: Priority Queue */}
        <div className="glass-card" style={{ flex: 1, padding: 20, overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 14 }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
                <Zap size={16} style={{ color: '#fbbf24' }} /> Priority Queue
              </h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Jobs ordered by weighted priority score (not FIFO)
              </p>
            </div>
            <LiveBadge />
          </div>

          {/* Branch Distribution Chips */}
          {stats && Object.keys(stats.branch_distribution).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {Object.entries(stats.branch_distribution).map(([branch, count]) => (
                <div key={branch} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '3px 10px', borderRadius: 20,
                  background: `${getBranchColor(branch)}15`,
                  border: `1px solid ${getBranchColor(branch)}30`,
                  fontSize: '0.72rem', fontWeight: 600, color: getBranchColor(branch),
                }}>
                  <GitBranch size={10} />
                  {branch}
                  <span style={{ background: `${getBranchColor(branch)}25`, padding: '0 5px', borderRadius: 8, fontFamily: 'monospace' }}>{count}</span>
                </div>
              ))}
            </div>
          )}

          {/* Priority Queue Items */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(!stats || stats.priority_queue.length === 0) && (
              <EmptyState text="Priority queue is empty. Waiting for git pushes…" />
            )}
            {stats?.priority_queue.map((job, idx) => (
              <PriorityQueueItem key={job.id} job={job} rank={idx + 1} />
            ))}
          </div>
        </div>

        {/* Center: Execution Visualizer */}
        <div className="glass-card" style={{ flex: 1.5, padding: 20, overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 14 }}>
            <div>
              <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc' }}>Execution Pipeline</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                Live view of multi-repo CI/CD runs with priority breakdown
              </p>
            </div>
            <LiveBadge />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {activeExecutions.length === 0 && <EmptyState text="No active executions. Simulator will trigger pushes shortly." />}
            {activeExecutions.map(ex => (
              <ExecutionCard key={ex.id} execution={ex} />
            ))}
          </div>
        </div>

        {/* Right: Event Timeline */}
        <div className="glass-card" style={{ flex: 0.7, padding: 20, overflowY: 'auto', maxHeight: 'calc(100vh - 240px)' }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={16} style={{ color: '#60a5fa' }} /> Event Timeline
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.length === 0 && <EmptyState text="Waiting for events…" />}
            {events.map((e, i) => (
              <div key={i} style={{
                padding: '10px 14px', background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                fontSize: '0.82rem', borderLeft: '3px solid var(--brand-primary)',
                animation: 'slideIn 0.3s ease-out',
              }}>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.72rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Activity size={10} />
                  {new Date(e.timestamp * 1000).toLocaleTimeString()}
                  {e.pending_jobs !== undefined && (
                    <span style={{ marginLeft: 'auto', color: '#fbbf24', fontFamily: 'monospace' }}>Q:{e.pending_jobs}</span>
                  )}
                </div>
                <div style={{ color: '#e2e8f0', lineHeight: 1.3 }}>{e.event}</div>
                {e.next_job && (
                  <div style={{ marginTop: 4, fontSize: '0.72rem', color: '#a78bfa' }}>
                    Next: {e.next_job.stage} ({e.next_job.branch}) → {e.next_job.score?.toFixed(1)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(10px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}

/* ────── Sub-Components ────── */

function StatCard({ icon, iconBg, iconColor, label, value }: { icon: React.ReactNode; iconBg: string; iconColor: string; label: string; value: string }) {
  return (
    <div className="stat-card glass-card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-secondary)', marginBottom: 12 }}>
        <div style={{ background: iconBg, padding: 7, borderRadius: 8, color: iconColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontWeight: 500, fontSize: '0.85rem' }}>{label}</span>
      </div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#f8fafc' }}>{value}</div>
    </div>
  );
}

function LiveBadge() {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', boxShadow: '0 0 8px #4ade80', animation: 'pulse 2s infinite' }} />
      <span style={{ fontSize: '0.75rem', color: '#4ade80', fontWeight: 600 }}>LIVE</span>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <div style={{ padding: 30, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10, fontSize: '0.85rem' }}>{text}</div>;
}

function PriorityQueueItem({ job, rank }: { job: any; rank: number }) {
  const branchColor = getBranchColor(job.branch_name || 'unknown');
  const TypeIcon = JOBTYPE_ICONS[job.job_type] || Box;
  return (
    <div style={{
      background: 'rgba(0,0,0,0.2)', borderRadius: 10, padding: '12px 14px',
      border: '1px solid rgba(255,255,255,0.04)',
      transition: 'all 0.2s', animation: 'slideIn 0.3s ease-out',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 24, height: 24, borderRadius: 6,
          background: `linear-gradient(135deg, ${branchColor}30, ${branchColor}10)`,
          border: `1px solid ${branchColor}40`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.7rem', fontWeight: 800, color: branchColor,
        }}>
          {rank}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 6 }}>
            <TypeIcon size={13} style={{ color: branchColor }} />
            {job.stage_name}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
            <GitBranch size={10} style={{ color: branchColor }} />
            <span style={{ color: branchColor }}>{job.branch_name}</span>
            <span style={{ opacity: 0.4 }}>•</span>
            <FolderGit2 size={10} />
            {getRepoOrg(job.repo_url)}
          </div>
        </div>
        <div style={{
          padding: '4px 10px', borderRadius: 16,
          background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)',
          fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem', color: '#fbbf24',
        }}>
          {job.priority_score?.toFixed(1)}
        </div>
      </div>

      {/* Commit info: message + SHA + author */}
      {job.commit_message && (
        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px', background: 'rgba(255,255,255,0.02)', borderRadius: 6 }}>
          <GitCommit size={10} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{job.commit_message}</span>
          {job.commit_sha && (
            <span style={{ flexShrink: 0, fontFamily: 'monospace', color: '#a78bfa', fontSize: '0.65rem' }}>{job.commit_sha.substring(0, 7)}</span>
          )}
        </div>
      )}

      {/* Changed files list (expandable) */}
      <FileChangesList files={job.changed_files_list} repoUrl={job.repo_url} />

      {/* Priority breakdown bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 8 }}>
        <PriorityBar label="Branch" value={job.priority_branch || 0} max={30} color={branchColor} />
        <PriorityBar label="Type" value={job.priority_jobtype || 0} max={25} color="#a78bfa" />
        <PriorityBar label="Commit" value={job.priority_commit || 0} max={20} color="#f472b6" />
        <PriorityBar label="Aging" value={job.priority_aging || 0} max={15} color="#fbbf24" />
        <PriorityBar label="Repo" value={job.priority_repo || 0} max={10} color="#38bdf8" />
      </div>
    </div>
  );
}

function ExecutionCard({ execution: ex }: { execution: any }) {
  const branchColor = getBranchColor(ex.branch_name || 'main');
  const statusConfig: Record<string, { bg: string; color: string }> = {
    completed: { bg: 'rgba(16,185,129,0.1)', color: '#4ade80' },
    running: { bg: 'rgba(59,130,246,0.1)', color: '#60a5fa' },
    pending: { bg: 'rgba(245,158,11,0.1)', color: '#fbbf24' },
    failed: { bg: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  };
  const sc = statusConfig[ex.status] || statusConfig.pending;

  return (
    <div style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: 'rgba(255,255,255,0.02)', padding: '10px 16px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.9rem', flexShrink: 0 }}>
            {ex.pipeline_name || ex.id?.substring(0, 8)}
          </span>
          {ex.branch_name && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4, padding: '2px 8px',
              borderRadius: 12, background: `${branchColor}15`, border: `1px solid ${branchColor}25`,
              fontSize: '0.7rem', fontWeight: 600, color: branchColor, flexShrink: 0,
            }}>
              <GitBranch size={9} />
              {ex.branch_name}
            </div>
          )}
          {ex.author && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: '0.68rem', color: '#94a3b8', flexShrink: 0 }}>
              <User size={9} />
              {ex.author}
            </div>
          )}
          {ex.commit_sha && (
            <span style={{ fontFamily: 'monospace', fontSize: '0.65rem', color: '#a78bfa', flexShrink: 0 }}>{ex.commit_sha.substring(0, 7)}</span>
          )}
          {ex.commit_message && (
            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <GitCommit size={9} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ex.commit_message}</span>
            </div>
          )}
        </div>
        <div style={{
          fontSize: '0.68rem', fontWeight: 700, padding: '3px 10px', borderRadius: 14,
          background: sc.bg, color: sc.color, textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          {ex.status}
        </div>
      </div>

      {/* Changed files for this execution */}
      {ex.changed_files_list && ex.changed_files_list.length > 0 && (
        <div style={{ padding: '0 14px' }}>
          <FileChangesList files={ex.changed_files_list} repoUrl={null} />
        </div>
      )}

      {/* Job stages */}
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {ex.jobs?.map((job: any) => {
          const isRunning = job.status === 'running';
          const isDone = job.status === 'completed' || job.status === 'done';
          const isFailed = job.status === 'failed';

          let bg = 'rgba(255,255,255,0.02)';
          let border = 'transparent';
          let statusColor = 'var(--text-muted)';
          let dot = '#475569';

          if (isRunning) { bg = 'rgba(59,130,246,0.06)'; border = 'rgba(59,130,246,0.2)'; statusColor = '#60a5fa'; dot = '#3b82f6'; }
          else if (isDone) { bg = 'rgba(16,185,129,0.04)'; border = 'rgba(16,185,129,0.15)'; statusColor = '#10b981'; dot = '#10b981'; }
          else if (isFailed) { bg = 'rgba(239,68,68,0.06)'; border = 'rgba(239,68,68,0.2)'; statusColor = '#ef4444'; dot = '#ef4444'; }

          const TypeIcon = JOBTYPE_ICONS[job.job_type] || Box;

          return (
            <div key={job.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
              background: bg, border: `1px solid ${border}`, borderRadius: 8,
              transition: 'all 0.2s',
            }}>
              <div style={{
                width: 8, height: 8, borderRadius: '50%', background: dot,
                boxShadow: isRunning ? '0 0 10px #3b82f6' : 'none',
                animation: isRunning ? 'pulse 1.5s infinite' : 'none',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 130 }}>
                <TypeIcon size={12} style={{ color: statusColor, flexShrink: 0 }} />
                <span style={{ fontWeight: 500, fontSize: '0.82rem', color: '#f8fafc' }}>{job.stage_name}</span>
              </div>
              <span style={{
                fontSize: '0.68rem', background: 'rgba(255,255,255,0.04)', padding: '2px 8px',
                borderRadius: 12, color: 'var(--text-secondary)',
              }}>
                {job.job_type}
              </span>

              <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                {/* Mini priority bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 60, height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', width: `${Math.min(100, job.priority_score || 0)}%`,
                      background: 'linear-gradient(90deg, #fbbf24, #f97316)',
                      borderRadius: 2, transition: 'width 0.5s ease',
                    }} />
                  </div>
                  <span style={{ fontFamily: 'monospace', color: '#fbbf24', fontSize: '0.75rem', fontWeight: 600, minWidth: 28, textAlign: 'right' }}>
                    {job.priority_score ? job.priority_score.toFixed(0) : '—'}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: statusColor, minWidth: 70, textAlign: 'right' }}>
                  {job.status.toUpperCase()}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
