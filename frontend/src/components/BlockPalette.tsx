import { DragEvent } from 'react';
import { GitBranch, Hammer, FlaskConical, Shield, Rocket, Code } from 'lucide-react';

export interface BlockDef {
  type: string;
  label: string;
  description: string;
  defaultScript: string;
}

const PALETTE_BLOCKS: BlockDef[] = [
  {
    type: 'trigger',
    label: 'Source Trigger',
    description: 'Git push / webhook event',
    defaultScript: 'git clone $REPO_URL && git checkout $BRANCH',
  },
  {
    type: 'build',
    label: 'Build Stage',
    description: 'Compile & package artifacts',
    defaultScript: 'docker build -t app .',
  },
  {
    type: 'test',
    label: 'Testing Stage',
    description: 'Unit & integration tests',
    defaultScript: 'npm test',
  },
  {
    type: 'security',
    label: 'Security Scan',
    description: 'SAST, secrets & dependency audit',
    defaultScript: 'trivy image app:latest',
  },
  {
    type: 'deploy',
    label: 'Deployment',
    description: 'Push to production / staging',
    defaultScript: 'kubectl apply -f deploy.yaml',
  },
  {
    type: 'lint',
    label: 'Lint / Quality',
    description: 'Code style & quality checks',
    defaultScript: 'eslint . --fix',
  },
];

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

function onDragStart(event: DragEvent<HTMLDivElement>, block: BlockDef) {
  event.dataTransfer.setData('application/reactflow-type', block.type);
  event.dataTransfer.setData('application/reactflow-label', block.label);
  event.dataTransfer.setData('application/reactflow-script', block.defaultScript);
  event.dataTransfer.effectAllowed = 'move';
}

export function BlockPalette() {
  return (
    <div className="block-palette">
      <div className="palette-header">
        <h3>Pipeline Blocks</h3>
        <span className="palette-hint">Drag onto canvas →</span>
      </div>
      <div className="palette-blocks">
        {PALETTE_BLOCKS.map((block) => (
          <div
            key={block.type}
            className="palette-block"
            draggable
            onDragStart={(e) => onDragStart(e, block)}
            style={{ '--block-color': COLOR_MAP[block.type] } as React.CSSProperties}
          >
            <div className="palette-block-icon" style={{ background: `${COLOR_MAP[block.type]}22`, color: COLOR_MAP[block.type] }}>
              {ICON_MAP[block.type]}
            </div>
            <div className="palette-block-info">
              <div className="palette-block-label">{block.label}</div>
              <div className="palette-block-desc">{block.description}</div>
            </div>
            <div className="palette-block-grip">
              <span /><span /><span />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export { PALETTE_BLOCKS, ICON_MAP, COLOR_MAP };
