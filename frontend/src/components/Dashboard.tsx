import { useEffect, useState } from 'react';
import { Activity, Server, Play, CheckCircle2 } from 'lucide-react';

export function Dashboard() {
  const [events, setEvents] = useState<any[]>([]);
  const [activeExecutions, setActiveExecutions] = useState<any[]>([]);

  useEffect(() => {
    // connect to SSE for events
    const evtSource = new EventSource('http://localhost:8100/api/events');
    evtSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setEvents(prev => [data, ...prev].slice(0, 50));
    };
    return () => evtSource.close();
  }, []);

  // Poll for active executions and their jobs to power the under-the-hood visualizer
  useEffect(() => {
    const fetchActiveState = async () => {
      try {
        const res = await fetch('http://localhost:8100/api/executions?limit=5');
        const execs = await res.json();
        
        // Fetch details for the first 3 active or recent executions
        const detailedExecs = await Promise.all(
          execs.slice(0, 3).map(async (ex: any) => {
            const detailRes = await fetch(`http://localhost:8100/api/executions/${ex.id}`);
            return detailRes.json();
          })
        );
        setActiveExecutions(detailedExecs);
      } catch (err) {
        console.error("Failed to fetch execution state", err);
      }
    };

    fetchActiveState();
    const interval = setInterval(fetchActiveState, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24, width: '100%', overflowY: 'auto', background: 'transparent' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
        <div className="stat-card glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', marginBottom: 16 }}>
            <div style={{ background: 'rgba(74, 222, 128, 0.1)', padding: 8, borderRadius: 8, color: '#4ade80' }}>
              <Activity size={20} />
            </div>
            <span style={{ fontWeight: 500 }}>System Status</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#f8fafc' }}>Healthy</div>
        </div>
        <div className="stat-card glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', marginBottom: 16 }}>
            <div style={{ background: 'rgba(96, 165, 250, 0.1)', padding: 8, borderRadius: 8, color: '#60a5fa' }}>
              <Server size={20} />
            </div>
            <span style={{ fontWeight: 500 }}>Active Workers</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#f8fafc' }}>4 / 4</div>
        </div>
        <div className="stat-card glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', marginBottom: 16 }}>
            <div style={{ background: 'rgba(251, 191, 36, 0.1)', padding: 8, borderRadius: 8, color: '#fbbf24' }}>
              <Play size={20} />
            </div>
            <span style={{ fontWeight: 500 }}>Active Executions</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#f8fafc' }}>
            {activeExecutions.filter(ex => ex.status === 'pending' || ex.status === 'running').length}
          </div>
        </div>
        <div className="stat-card glass-card" style={{ padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', marginBottom: 16 }}>
            <div style={{ background: 'rgba(167, 139, 250, 0.1)', padding: 8, borderRadius: 8, color: '#a78bfa' }}>
              <CheckCircle2 size={20} />
            </div>
            <span style={{ fontWeight: 500 }}>Completed Today</span>
          </div>
          <div style={{ fontSize: '2rem', fontWeight: 600, color: '#f8fafc' }}>128</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 24, flex: 1, minHeight: 400 }}>
        <div className="glass-card" style={{ flex: 2, padding: 24, overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>
            <div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc' }}>Execution Visualizer</h3>
              <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                Live view of scheduler priorities and active stages
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#fbbf24', boxShadow: '0 0 8px #fbbf24', alignSelf: 'center' }} />
              <span style={{ fontSize: '0.85rem', color: '#fbbf24' }}>Live Updates</span>
            </div>
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {activeExecutions.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: 12 }}>
                No active jobs to visualize. Trigger a pipeline to begin.
              </div>
            )}
            
            {activeExecutions.map(ex => (
              <div key={ex.id} style={{ background: 'rgba(0,0,0,0.2)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
                <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontWeight: 500, color: '#e2e8f0' }}>
                    Pipeline: <span style={{ color: '#60a5fa', marginLeft: 8 }}>{ex.pipeline_name || ex.id.substring(0, 8)}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 600, padding: '4px 12px', borderRadius: 16, background: ex.status === 'completed' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)', color: ex.status === 'completed' ? '#4ade80' : '#fbbf24' }}>
                    {ex.status.toUpperCase()}
                  </div>
                </div>
                
                <div style={{ padding: 20 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {ex.jobs && ex.jobs.map((job: any) => {
                      const isRunning = job.status === 'running';
                      const isDone = job.status === 'completed' || job.status === 'done';
                      
                      let bgColor = 'rgba(255,255,255,0.02)';
                      let borderColor = 'transparent';
                      let statusColor = 'var(--text-muted)';
                      
                      if (isRunning) {
                        bgColor = 'rgba(59, 130, 246, 0.08)';
                        borderColor = 'rgba(59, 130, 246, 0.3)';
                        statusColor = '#60a5fa';
                      } else if (isDone) {
                        bgColor = 'rgba(16, 185, 129, 0.05)';
                        borderColor = 'rgba(16, 185, 129, 0.2)';
                        statusColor = '#10b981';
                      }
                      
                      return (
                        <div key={job.id} style={{ 
                          display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', 
                          background: bgColor, border: `1px solid ${borderColor}`, borderRadius: 8,
                          transition: 'all 0.2s'
                        }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 12 }}>
                            <div style={{ 
                              width: 10, height: 10, borderRadius: '50%', 
                              background: isRunning ? '#3b82f6' : (isDone ? '#10b981' : '#475569'),
                              boxShadow: isRunning ? '0 0 12px #3b82f6' : 'none'
                             }} />
                            <span style={{ fontWeight: 500, minWidth: 140, color: '#f8fafc' }}>{job.stage_name}</span>
                            <span style={{ fontSize: '0.75rem', background: 'rgba(255,255,255,0.05)', padding: '4px 10px', borderRadius: 16, color: 'var(--text-secondary)' }}>
                              {job.job_type}
                            </span>
                          </div>
                          
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Priority Score</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ width: 80, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${Math.min(100, Math.max(5, (job.priority_score || 0)))}%`, background: '#fbbf24', boxShadow: '0 0 8px #fbbf24' }} />
                                </div>
                                <span style={{ fontFamily: 'monospace', color: '#fbbf24', fontSize: '0.9rem' }}>
                                  {job.priority_score ? job.priority_score.toFixed(1) : 'WAIT'}
                                </span>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end', minWidth: 100 }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</span>
                              <span style={{ fontSize: '0.9rem', fontWeight: 600, color: statusColor }}>
                                {job.status.toUpperCase()}
                              </span>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="glass-card" style={{ flex: 1, padding: 24, overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 24px 0', fontSize: '1.25rem', fontWeight: 600, color: '#f8fafc', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 16 }}>Event Timeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {events.length === 0 && <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: 40 }}>Waiting for real-time events...</div>}
            {events.map((e, i) => (
              <div key={i} style={{ 
                padding: '12px 16px', 
                background: 'rgba(255,255,255,0.02)', 
                borderRadius: 8, 
                fontSize: '0.9rem', 
                borderLeft: '3px solid var(--brand-primary)',
                transition: 'transform 0.2s',
                animation: 'slideIn 0.3s ease-out'
              }}>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Activity size={12} />
                  {new Date(e.timestamp * 1000).toLocaleTimeString()}
                </div>
                <div style={{ color: '#e2e8f0', lineHeight: 1.4 }}>{e.event}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style>
        {`
          @keyframes slideIn {
            from { opacity: 0; transform: translateX(10px); }
            to { opacity: 1; transform: translateX(0); }
          }
        `}
      </style>
    </div>
  );
}
