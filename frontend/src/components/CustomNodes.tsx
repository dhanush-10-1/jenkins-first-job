import { Handle, Position } from 'reactflow';
import { Settings, Play, CheckCircle, AlertCircle, Shield } from 'lucide-react';

export function StageNode({ data }: { data: any }) {
  const getIcon = () => {
    switch (data.type) {
      case 'build': return <Settings size={18} />;
      case 'test': return <Play size={18} />;
      case 'deploy': return <CheckCircle size={18} />;
      case 'lint': return <AlertCircle size={18} />;
      case 'security': return <Shield size={18} />;
      default: return <Settings size={18} />;
    }
  };

  const getColor = () => {
    switch (data.type) {
      case 'build': return 'linear-gradient(135deg, #3b82f6, #60a5fa)';
      case 'test': return 'linear-gradient(135deg, #8b5cf6, #a78bfa)';
      case 'deploy': return 'linear-gradient(135deg, #10b981, #34d399)';
      case 'lint': return 'linear-gradient(135deg, #f59e0b, #fbbf24)';
      case 'security': return 'linear-gradient(135deg, #ef4444, #f87171)';
      default: return 'linear-gradient(135deg, #64748b, #94a3b8)';
    }
  };

  return (
    <div 
      className="glass-card"
      style={{ 
        minWidth: 180, 
        padding: '12px 16px',
        borderLeft: '4px solid transparent',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, bottom: 0, width: 4,
          background: getColor()
        }}
      />
      
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ background: '#3b82f6', width: 10, height: 10, border: '2px solid #09090b', left: -5 }} 
      />
      
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ 
          background: 'rgba(255,255,255,0.1)', 
          padding: 6, 
          borderRadius: 8, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#fff'
        }}>
          {getIcon()}
        </div>
        <strong style={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '0.01em', color: '#f8fafc' }}>{data.label}</strong>
      </div>
      
      <div style={{ fontSize: '0.85rem', color: '#94a3b8', paddingTop: 8, fontFamily: 'monospace', fontWeight: 500 }}>
        {data.script || 'No script defined'}
      </div>
      
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ background: '#3b82f6', width: 10, height: 10, border: '2px solid #09090b', right: -5 }} 
      />
    </div>
  );
}
