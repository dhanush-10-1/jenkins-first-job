import { Handle, Position } from 'reactflow';
import { GitBranch, Hammer, FlaskConical, Shield, Rocket, Code, Pencil } from 'lucide-react';

const ICON_MAP: Record<string, React.ReactNode> = {
  trigger:  <GitBranch size={18} />,
  build:    <Hammer size={18} />,
  test:     <FlaskConical size={18} />,
  security: <Shield size={18} />,
  deploy:   <Rocket size={18} />,
  lint:     <Code size={18} />,
};

const COLOR_MAP: Record<string, string> = {
  trigger:  '#f97316',
  build:    '#3b82f6',
  test:     '#8b5cf6',
  security: '#ef4444',
  deploy:   '#10b981',
  lint:     '#f59e0b',
};

const GRADIENT_MAP: Record<string, string> = {
  trigger:  'linear-gradient(135deg, #f97316, #fb923c)',
  build:    'linear-gradient(135deg, #3b82f6, #60a5fa)',
  test:     'linear-gradient(135deg, #8b5cf6, #a78bfa)',
  deploy:   'linear-gradient(135deg, #10b981, #34d399)',
  lint:     'linear-gradient(135deg, #f59e0b, #fbbf24)',
  security: 'linear-gradient(135deg, #ef4444, #f87171)',
};

export function StageNode({ data }: { data: any }) {
  const stageType = data.type || 'build';
  const icon = ICON_MAP[stageType] || ICON_MAP['build'];
  const gradient = GRADIENT_MAP[stageType] || GRADIENT_MAP['build'];
  const accentColor = COLOR_MAP[stageType] || COLOR_MAP['build'];

  return (
    <div 
      className="stage-node glass-card"
      style={{ 
        minWidth: 200, 
        padding: '14px 18px',
        borderLeft: '4px solid transparent',
        transition: 'all 0.3s ease',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Colored left accent bar */}
      <div 
        style={{
          position: 'absolute',
          top: 0, left: 0, bottom: 0, width: 4,
          background: gradient,
        }}
      />
      
      <Handle 
        type="target" 
        position={Position.Left} 
        style={{ background: accentColor, width: 10, height: 10, border: '2px solid #09090b', left: -5 }} 
      />
      
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ 
          background: `${accentColor}22`, 
          padding: 6, 
          borderRadius: 8, 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: accentColor,
        }}>
          {icon}
        </div>
        <strong style={{ fontSize: '1.05rem', fontWeight: 600, letterSpacing: '0.01em', color: '#f8fafc', flex: 1 }}>
          {data.label}
        </strong>
        <div 
          className="stage-node-edit-hint"
          style={{
            opacity: 0,
            transition: 'opacity 0.2s',
            color: 'var(--text-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: '0.7rem',
          }}
        >
          <Pencil size={11} />
          edit
        </div>
      </div>

      {/* Type badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 8 }}>
        <span style={{ 
          fontSize: '0.7rem', 
          textTransform: 'uppercase', 
          fontWeight: 600, 
          letterSpacing: '0.06em',
          background: `${accentColor}18`,
          color: accentColor,
          padding: '3px 8px',
          borderRadius: 6,
        }}>
          {stageType}
        </span>
      </div>
      
      {/* Script preview */}
      <div style={{ 
        fontSize: '0.8rem', 
        color: '#94a3b8', 
        paddingTop: 8, 
        fontFamily: '"JetBrains Mono", "Fira Code", monospace', 
        fontWeight: 400,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        maxWidth: 220,
      }}>
        {data.script || 'No script defined'}
      </div>
      
      <Handle 
        type="source" 
        position={Position.Right} 
        style={{ background: accentColor, width: 10, height: 10, border: '2px solid #09090b', right: -5 }} 
      />
    </div>
  );
}
