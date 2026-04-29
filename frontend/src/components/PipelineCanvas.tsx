import { useCallback, useRef, DragEvent } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
} from 'reactflow';
import type { Node, Edge, Connection, NodeChange, EdgeChange, ReactFlowInstance } from 'reactflow';
import 'reactflow/dist/style.css';

interface PipelineCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onNodeClick?: (event: React.MouseEvent, node: Node) => void;
  onDropNode?: (type: string, label: string, script: string, position: { x: number; y: number }) => void;
  nodeTypes?: any;
}

let idCounter = 0;
function nextId() {
  return `stage_${Date.now()}_${idCounter++}`;
}

export function PipelineCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onNodeClick,
  onDropNode,
  nodeTypes,
}: PipelineCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const defaultEdgeOptions = {
    style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 2 },
    animated: true,
  };

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  const onDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-type');
      const label = event.dataTransfer.getData('application/reactflow-label');
      const script = event.dataTransfer.getData('application/reactflow-script');

      if (!type || !reactFlowInstance.current || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.current.project({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      if (onDropNode) {
        onDropNode(type, label, script, position);
      }
    },
    [onDropNode]
  );

  return (
    <div
      className="react-flow-wrapper"
      ref={reactFlowWrapper}
      style={{ width: '100%', height: '100%' }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onInit={onInit}
        onDragOver={onDragOver}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        deleteKeyCode={['Backspace', 'Delete']}
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="rgba(255, 255, 255, 0.05)" />
        <Controls style={{ background: 'rgba(24, 24, 27, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', fill: '#fff' }} />
        <MiniMap 
          nodeColor={(n: any) => {
            const colors: Record<string, string> = {
              trigger: '#f97316', build: '#3b82f6', test: '#8b5cf6',
              security: '#ef4444', deploy: '#10b981', lint: '#f59e0b',
            };
            return colors[n.data?.type] || '#3b82f6';
          }}
          maskColor="rgba(0,0,0,0.4)"
          style={{ background: 'rgba(24, 24, 27, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
        />
      </ReactFlow>
    </div>
  );
}
