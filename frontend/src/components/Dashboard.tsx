import React, { useEffect, useState } from 'react';
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
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20, width: '100%', overflowY: 'auto' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 15 }}>
        <div className="stat-card" style={{ background: '#1e1e1e', padding: 20, borderRadius: 8, border: '1px solid #333' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', marginBottom: 10 }}>
            <Activity size={18} /> System Status
          </div>
          <div style={{ fontSize: '1.5rem', color: '#4ade80' }}>Healthy</div>
        </div>
        <div className="stat-card" style={{ background: '#1e1e1e', padding: 20, borderRadius: 8, border: '1px solid #333' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', marginBottom: 10 }}>
            <Server size={18} /> Active Workers
          </div>
          <div style={{ fontSize: '1.5rem', color: '#60a5fa' }}>4 / 4</div>
        </div>
        <div className="stat-card" style={{ background: '#1e1e1e', padding: 20, borderRadius: 8, border: '1px solid #333' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', marginBottom: 10 }}>
            <Play size={18} /> Active Executions
          </div>
          <div style={{ fontSize: '1.5rem', color: '#fbbf24' }}>
            {activeExecutions.filter(ex => ex.status === 'pending' || ex.status === 'running').length}
          </div>
        </div>
        <div className="stat-card" style={{ background: '#1e1e1e', padding: 20, borderRadius: 8, border: '1px solid #333' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#aaa', marginBottom: 10 }}>
            <CheckCircle2 size={18} /> Completed Today
          </div>
          <div style={{ fontSize: '1.5rem', color: '#fff' }}>128</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 20, flex: 1, minHeight: 400 }}>
        <div style={{ flex: 2, background: '#1e1e1e', padding: 20, borderRadius: 8, border: '1px solid #333', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 20px 0', borderBottom: '1px solid #333', paddingBottom: 10 }}>Under-the-Hood Visualizer</h3>
          <p style={{ color: '#aaa', fontSize: '0.9rem', marginBottom: 20 }}>
            Live view of scheduler priorities, queue placement, and active pipeline stages.
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
            {activeExecutions.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center', color: '#666', border: '1px dashed #444', borderRadius: 8 }}>
                No active jobs to visualize. Trigger a pipeline to begin.
              </div>
            )}
            
            {activeExecutions.map(ex => (
              <div key={ex.id} style={{ background: '#252526', borderRadius: 8, border: '1px solid #444', overflow: 'hidden' }}>
                <div style={{ background: '#2d2d2d', padding: '10px 15px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 600, color: '#fff' }}>
                    Pipeline: <span style={{ color: '#60a5fa' }}>{ex.pipeline_name || ex.id.substring(0, 8)}</span>
                  </div>
                  <div style={{ fontSize: '0.8rem', padding: '4px 8px', borderRadius: 4, background: ex.status === 'completed' ? '#052e16' : '#451a03', color: ex.status === 'completed' ? '#4ade80' : '#fbbf24' }}>
                    {ex.status.toUpperCase()}
                  </div>
                </div>
                
                <div style={{ padding: 15 }}>
                  <div style={{ marginBottom: 10, fontSize: '0.85rem', color: '#888', fontWeight: 600, textTransform: 'uppercase' }}>
                    Job Priority Queue & Stages
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {ex.jobs && ex.jobs.map((job: any) => {
                      const isRunning = job.status === 'running';
                      const isDone = job.status === 'completed' || job.status === 'done';
                      
                      let bgColor = '#1e1e1e';
                      let borderColor = '#333';
                      let statusColor = '#888';
                      
                      if (isRunning) {
                        bgColor = '#1e293b';
                        borderColor = '#3b82f6';
                        statusColor = '#60a5fa';
                      } else if (isDone) {
                        bgColor = '#0f172a';
                        borderColor = '#0f766e';
                        statusColor = '#14b8a6';
                      }
                      
                      return (
                        <div key={job.id} style={{ 
                          display: 'flex', alignItems: 'center', gap: 15, padding: 12, 
                          background: bgColor, border: \`1px solid \${borderColor}\`, borderRadius: 6
                        }}>
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ 
                              width: 12, height: 12, borderRadius: '50%', 
                              background: isRunning ? '#3b82f6' : (isDone ? '#10b981' : '#444'),
                              boxShadow: isRunning ? '0 0 8px #3b82f6' : 'none'
                             }} />
                            <span style={{ fontWeight: 500, minWidth: 150 }}>{job.stage_name}</span>
                            <span style={{ fontSize: '0.75rem', background: '#333', padding: '2px 8px', borderRadius: 12, color: '#ccc' }}>
                              Type: {job.job_type}
                            </span>
                          </div>
                          
                          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderLeft: '1px solid #444', paddingLeft: 15 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                              <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>Priority Score</span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 60, height: 6, background: '#333', borderRadius: 3, overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: \`\${Math.min(100, Math.max(5, (job.priority_score || 0)))}\` + '%', background: '#eab308' }} />
                                </div>
                                <span style={{ fontFamily: 'monospace', color: '#eab308' }}>
                                  {job.priority_score ? job.priority_score.toFixed(1) : 'WAIT'}
                                </span>
                              </div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end', minWidth: 100 }}>
                              <span style={{ fontSize: '0.7rem', color: '#888', textTransform: 'uppercase' }}>Status</span>
                              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: statusColor }}>
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
        <div style={{ flex: 1, background: '#1e1e1e', padding: 20, borderRadius: 8, border: '1px solid #333', overflowY: 'auto' }}>
          <h3 style={{ margin: '0 0 20px 0', borderBottom: '1px solid #333', paddingBottom: 10 }}>Event Timeline</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {events.length === 0 && <div style={{ color: '#666', textAlign: 'center', marginTop: 20 }}>Waiting for events...</div>}
            {events.map((e, i) => (
              <div key={i} style={{ padding: '10px 15px', background: '#2a2a2a', borderRadius: 4, fontSize: '0.9rem', borderLeft: '3px solid #60a5fa' }}>
                <div style={{ color: '#888', fontSize: '0.8rem', marginBottom: 4 }}>{new Date(e.timestamp * 1000).toLocaleTimeString()}</div>
                <div>{e.event}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
