import { useState } from 'react';
import { X, Trash2 } from 'lucide-react';
import type { Node } from 'reactflow';
import { COLOR_MAP, ICON_MAP } from './BlockPalette';

interface NodeEditorProps {
  node: Node | null;
  onUpdate: (id: string, data: Record<string, any>) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = ['trigger', 'build', 'test', 'security', 'deploy', 'lint'];

export function NodeEditor({ node, onUpdate, onDelete, onClose }: NodeEditorProps) {
  const [label, setLabel] = useState(node?.data?.label ?? '');
  const [type, setType] = useState(node?.data?.type ?? 'build');
  const [script, setScript] = useState(node?.data?.script ?? '');

  if (!node) return null;

  const handleApply = () => {
    onUpdate(node.id, { label, type, script });
  };

  const accentColor = COLOR_MAP[type] || '#3b82f6';

  return (
    <div className="node-editor-overlay" onClick={onClose}>
      <div className="node-editor" onClick={(e) => e.stopPropagation()}>
        <div className="node-editor-header" style={{ borderColor: accentColor }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: `${accentColor}22`, color: accentColor, padding: 6, borderRadius: 8, display: 'flex' }}>
              {ICON_MAP[type] || ICON_MAP['build']}
            </div>
            <h3>Edit Stage</h3>
          </div>
          <button className="node-editor-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="node-editor-body">
          <div className="node-editor-field">
            <label>Stage Name</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. build, unit-tests, deploy-prod"
              spellCheck={false}
            />
          </div>

          <div className="node-editor-field">
            <label>Stage Type</label>
            <div className="type-selector">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t}
                  className={`type-chip ${type === t ? 'active' : ''}`}
                  style={type === t ? { background: `${COLOR_MAP[t]}22`, borderColor: COLOR_MAP[t], color: COLOR_MAP[t] } : {}}
                  onClick={() => setType(t)}
                >
                  {ICON_MAP[t]}
                  <span>{t}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="node-editor-field">
            <label>Script / Command</label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={4}
              placeholder="echo 'hello world'"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="node-editor-footer">
          <button className="btn-delete" onClick={() => { onDelete(node.id); onClose(); }}>
            <Trash2 size={15} />
            Delete Stage
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
            <button className="btn-primary" onClick={handleApply} style={{ background: accentColor }}>
              Apply Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
