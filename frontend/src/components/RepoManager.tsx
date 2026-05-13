import { useEffect, useState, useCallback } from 'react';
import {
  FolderGit2, GitBranch, Link2, Plus, Copy, Check,
  ExternalLink, Trash2, Shield, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Webhook
} from 'lucide-react';

interface PipelineRepo {
  id: string;
  name: string;
  repo_url: string | null;
  branch: string;
  trigger_on_push: boolean;
  created_at: string;
}

interface WebhookInfo {
  github_url: string;
  gitlab_url: string;
  secret_configured: boolean;
  base_url: string;
  instructions: {
    github: string[];
    gitlab: string[];
  };
}

const API = 'http://localhost:8100';

export function RepoManager() {
  const [repos, setRepos] = useState<PipelineRepo[]>([]);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSetup, setShowSetup] = useState<'github' | 'gitlab' | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '', repo_url: '', branch: 'main', trigger_on_push: true,
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchRepos = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/pipelines/`);
      const data = await res.json();
      setRepos(data.filter((p: any) => p.repo_url));
    } catch (e) { console.error('Failed to fetch repos', e); }
  }, []);

  const fetchWebhookInfo = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/webhook-info`);
      setWebhookInfo(await res.json());
    } catch (e) { console.error('Failed to fetch webhook info', e); }
  }, []);

  useEffect(() => { fetchRepos(); fetchWebhookInfo(); }, [fetchRepos, fetchWebhookInfo]);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const addRepo = async () => {
    if (!formData.name || !formData.repo_url) return;
    setSubmitting(true);
    try {
      await fetch(`${API}/api/pipelines/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      setFormData({ name: '', repo_url: '', branch: 'main', trigger_on_push: true });
      setShowForm(false);
      fetchRepos();
    } catch (e) { console.error('Failed to add repo', e); }
    setSubmitting(false);
  };

  const deleteRepo = async (id: string) => {
    try {
      await fetch(`${API}/api/pipelines/${id}`, { method: 'DELETE' });
      fetchRepos();
    } catch (e) { console.error('Failed to delete', e); }
  };

  return (
    <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 20, width: '100%', overflowY: 'auto' }}>

      {/* ── Webhook URL Cards ── */}
      {webhookInfo && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <WebhookUrlCard
            provider="GitHub"
            url={webhookInfo.github_url}
            icon={<FolderGit2 size={18} />}
            color="#4ade80"
            copied={copied}
            onCopy={(text, key) => copyToClipboard(text, key)}
            onSetup={() => setShowSetup(showSetup === 'github' ? null : 'github')}
            instructions={webhookInfo.instructions.github}
            showInstructions={showSetup === 'github'}
          />
          <WebhookUrlCard
            provider="GitLab"
            url={webhookInfo.gitlab_url}
            icon={<FolderGit2 size={18} />}
            color="#f97316"
            copied={copied}
            onCopy={(text, key) => copyToClipboard(text, key)}
            onSetup={() => setShowSetup(showSetup === 'gitlab' ? null : 'gitlab')}
            instructions={webhookInfo.instructions.gitlab}
            showInstructions={showSetup === 'gitlab'}
          />
        </div>
      )}

      {/* ── Secret Status ── */}
      {webhookInfo && (
        <div className="glass-card" style={{ padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 10 }}>
          {webhookInfo.secret_configured ? (
            <>
              <Shield size={16} style={{ color: '#4ade80' }} />
              <span style={{ color: '#4ade80', fontSize: '0.85rem', fontWeight: 600 }}>HMAC-SHA256 signature verification is active</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 'auto' }}>SECRET_KEY env var is set</span>
            </>
          ) : (
            <>
              <AlertTriangle size={16} style={{ color: '#fbbf24' }} />
              <span style={{ color: '#fbbf24', fontSize: '0.85rem', fontWeight: 600 }}>Signature verification disabled</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginLeft: 'auto' }}>Set SECRET_KEY env var to enable HMAC verification</span>
            </>
          )}
        </div>
      )}

      {/* ── Registered Repos ── */}
      <div className="glass-card" style={{ padding: 20, flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: 14 }}>
          <div>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
              <FolderGit2 size={16} style={{ color: '#a78bfa' }} /> Registered Repositories
            </h3>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Pipelines linked to real repos — pushes trigger builds automatically
            </p>
          </div>
          <button onClick={() => setShowForm(!showForm)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 8,
            background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', border: 'none', color: '#fff',
            fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', transition: 'all 0.2s',
            fontFamily: 'Outfit, sans-serif',
          }}>
            <Plus size={14} /> Add Repository
          </button>
        </div>

        {/* ── Add Repo Form ── */}
        {showForm && (
          <div style={{
            padding: 18, borderRadius: 10, marginBottom: 16,
            background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.15)',
            display: 'flex', flexDirection: 'column', gap: 12, animation: 'slideIn 0.2s ease-out',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 0.8fr', gap: 12 }}>
              <div>
                <label style={labelStyle}>Pipeline Name</label>
                <input
                  value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                  placeholder="my-api" style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Repository URL</label>
                <input
                  value={formData.repo_url} onChange={e => setFormData({ ...formData, repo_url: e.target.value })}
                  placeholder="https://github.com/user/repo.git" style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle}>Branch</label>
                <input
                  value={formData.branch} onChange={e => setFormData({ ...formData, branch: e.target.value })}
                  placeholder="main" style={inputStyle}
                />
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#cbd5e1', fontSize: '0.85rem', cursor: 'pointer' }}>
                <input
                  type="checkbox" checked={formData.trigger_on_push}
                  onChange={e => setFormData({ ...formData, trigger_on_push: e.target.checked })}
                  style={{ accentColor: '#a78bfa' }}
                />
                <Webhook size={14} /> Trigger on push
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowForm(false)} style={{ ...btnStyle, background: 'rgba(255,255,255,0.05)', color: '#94a3b8' }}>Cancel</button>
                <button onClick={addRepo} disabled={submitting || !formData.name || !formData.repo_url} style={{
                  ...btnStyle,
                  background: (!formData.name || !formData.repo_url) ? 'rgba(167,139,250,0.2)' : 'linear-gradient(135deg, #a78bfa, #7c3aed)',
                  color: '#fff', opacity: (!formData.name || !formData.repo_url) ? 0.5 : 1,
                }}>
                  {submitting ? 'Adding…' : 'Register Repository'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Repo List ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {repos.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 10, fontSize: '0.85rem' }}>
              No repositories registered yet. Add one above or push to the webhook URL — pipelines auto-register.
            </div>
          )}
          {repos.map(repo => (
            <div key={repo.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '14px 16px',
              background: 'rgba(0,0,0,0.2)', borderRadius: 10,
              border: '1px solid rgba(255,255,255,0.04)', transition: 'all 0.2s',
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#a78bfa', flexShrink: 0,
              }}>
                <FolderGit2 size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: '#f8fafc', marginBottom: 2 }}>{repo.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontFamily: 'monospace' }}>
                    <Link2 size={10} /> {repo.repo_url}
                  </span>
                </div>
              </div>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '3px 10px', borderRadius: 16,
                background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.2)',
                fontSize: '0.72rem', fontWeight: 600, color: '#60a5fa', flexShrink: 0,
              }}>
                <GitBranch size={10} /> {repo.branch}
              </div>
              <div style={{
                padding: '3px 10px', borderRadius: 16, fontSize: '0.72rem', fontWeight: 600, flexShrink: 0,
                background: repo.trigger_on_push ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                color: repo.trigger_on_push ? '#4ade80' : '#64748b',
                border: `1px solid ${repo.trigger_on_push ? 'rgba(74,222,128,0.2)' : 'rgba(255,255,255,0.06)'}`,
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                {repo.trigger_on_push ? <><CheckCircle2 size={10} /> Active</> : 'Disabled'}
              </div>
              <button onClick={() => deleteRepo(repo.id)} style={{
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.15)',
                borderRadius: 6, padding: 6, cursor: 'pointer', color: '#ef4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s',
              }}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── How It Works ── */}
      <div className="glass-card" style={{ padding: 20 }}>
        <h3 style={{ margin: '0 0 14px 0', fontSize: '1rem', fontWeight: 600, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Webhook size={16} style={{ color: '#fbbf24' }} /> How Real Webhooks Work
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {[
            { step: '1', title: 'Register Repo', desc: 'Add your repo URL + branch above (or just push — auto-registers)' },
            { step: '2', title: 'Configure Webhook', desc: 'Paste the webhook URL into GitHub/GitLab repo settings' },
            { step: '3', title: 'Expose Locally', desc: 'Use ngrok: ngrok http 8100 — set WEBHOOK_BASE_URL to the ngrok URL' },
            { step: '4', title: 'Push Code', desc: 'git push triggers the pipeline with real commit data, files, and priority scoring' },
          ].map(s => (
            <div key={s.step} style={{
              padding: 14, background: 'rgba(255,255,255,0.02)', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.04)',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6, background: 'rgba(251,191,36,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 800, fontSize: '0.75rem', color: '#fbbf24', marginBottom: 8,
              }}>{s.step}</div>
              <div style={{ fontWeight: 600, color: '#e2e8f0', fontSize: '0.85rem', marginBottom: 4 }}>{s.title}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', lineHeight: 1.4 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

/* ─── Sub-components & styles ─── */

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '0.72rem', fontWeight: 600, color: '#94a3b8',
  textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px', borderRadius: 8,
  background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.08)',
  color: '#f8fafc', fontSize: '0.85rem', fontFamily: 'Outfit, sans-serif',
  outline: 'none', boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 16px', borderRadius: 8, border: 'none',
  fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer',
  fontFamily: 'Outfit, sans-serif', transition: 'all 0.2s',
};

function WebhookUrlCard({ provider, url, icon, color, copied, onCopy, onSetup, instructions, showInstructions }: {
  provider: string; url: string; icon: React.ReactNode; color: string;
  copied: string | null; onCopy: (text: string, key: string) => void;
  onSetup: () => void; instructions: string[]; showInstructions: boolean;
}) {
  const key = provider.toLowerCase();
  return (
    <div className="glass-card" style={{ padding: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ background: `${color}15`, padding: 7, borderRadius: 8, color, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{icon}</div>
        <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#f8fafc' }}>{provider} Webhook URL</span>
      </div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8,
        background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 10,
      }}>
        <code style={{ flex: 1, fontSize: '0.8rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</code>
        <button onClick={() => onCopy(url, key)} style={{
          background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 6, padding: 5,
          cursor: 'pointer', color: copied === key ? '#4ade80' : '#94a3b8', display: 'flex', alignItems: 'center',
          transition: 'all 0.2s',
        }}>
          {copied === key ? <Check size={14} /> : <Copy size={14} />}
        </button>
      </div>
      <button onClick={onSetup} style={{
        display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
        color: color, fontSize: '0.78rem', cursor: 'pointer', fontWeight: 600,
        fontFamily: 'Outfit, sans-serif', padding: 0,
      }}>
        {showInstructions ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <ExternalLink size={11} /> Setup Instructions
      </button>
      {showInstructions && (
        <div style={{
          marginTop: 10, padding: 12, borderRadius: 8, background: 'rgba(0,0,0,0.2)',
          border: '1px solid rgba(255,255,255,0.04)', animation: 'slideIn 0.2s ease-out',
        }}>
          {instructions.map((step, i) => (
            <div key={i} style={{
              fontSize: '0.78rem', color: '#cbd5e1', padding: '4px 0', display: 'flex', alignItems: 'flex-start', gap: 8,
              borderBottom: i < instructions.length - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none',
            }}>
              <span style={{ color, fontWeight: 700, flexShrink: 0 }}>{i + 1}.</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
