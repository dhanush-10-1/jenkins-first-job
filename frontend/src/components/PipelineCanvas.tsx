import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  BackgroundVariant
} from 'reactflow';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from 'reactflow';
import 'reactflow/dist/style.css';

interface PipelineCanvasProps {
  nodes: Node[];
  edges: Edge[];
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  nodeTypes?: any;
}

export function PipelineCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  nodeTypes
}: PipelineCanvasProps) {
  const defaultEdgeOptions = {
    style: { stroke: 'rgba(255, 255, 255, 0.2)', strokeWidth: 2 },
    animated: true,
  };

  return (
    <div className="react-flow-wrapper" style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="rgba(255, 255, 255, 0.05)" />
        <Controls style={{ background: 'rgba(24, 24, 27, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)', fill: '#fff' }} />
        <MiniMap 
          nodeColor={(n: any) => n.type === 'stageNode' ? '#3b82f6' : '#fff'}
          maskColor="rgba(0,0,0,0.4)"
          style={{ background: 'rgba(24, 24, 27, 0.8)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
        />
      </ReactFlow>
    </div>
  );
}
