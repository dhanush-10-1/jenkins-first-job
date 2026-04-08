import React from 'react';
import { Handle, Position } from 'reactflow';
import { Settings, Play, CheckCircle, AlertCircle, Shield } from 'lucide-react';

export function StageNode({ data }: { data: any }) {
  const getIcon = () => {
    switch (data.type) {
      case 'build': return <Settings size={16} />;
      case 'test': return <Play size={16} />;
      case 'deploy': return <CheckCircle size={16} />;
      case 'lint': return <AlertCircle size={16} />;
      case 'security': return <Shield size={16} />;
      default: return <Settings size={16} />;
    }
  };

  return (
    <div style={{ padding: 10, border: '1px solid #333', borderRadius: 5, background: '#1e1e1e', color: 'white', minWidth: 150 }}>
      <Handle type="target" position={Position.Top} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 5, borderBottom: '1px solid #444' }}>
        {getIcon()}
        <strong>{data.label}</strong>
      </div>
      <div style={{ fontSize: 12, color: '#aaa', paddingTop: 5 }}>{data.script || 'No script'}</div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
