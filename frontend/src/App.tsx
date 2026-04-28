import { useState, useEffect, useCallback, useMemo } from 'react';
import { PipelineCanvas } from './components/PipelineCanvas';
import { YamlEditor } from './components/YamlEditor';
import { yamlToGraph, graphToYaml } from './lib/sync';
import { StageNode } from './components/CustomNodes';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from 'reactflow';
import './index.css';

import { Dashboard } from './components/Dashboard';

const initialYaml = `name: My Pipeline
stages:
  build:
    type: build
    script: docker build -t app .
  test:
    type: test
    depends_on: build
    script: npm test
  deploy:
    type: deploy
    depends_on: test
    script: kubectl apply -f .
`;

function App() {
  const [activeTab, setActiveTab] = useState('designer');
  const [yamlValue, setYamlValue] = useState(initialYaml);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const nodeTypes = useMemo(() => ({ stageNode: StageNode }), []);

  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = yamlToGraph(yamlValue);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [yamlValue]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds);
      if (changes.some(c => c.type === 'remove')) {
        // structural change -> update yaml
        setYamlValue(graphToYaml(updated, edges));
      }
      return updated;
    });
  }, [edges]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => {
      const updated = applyEdgeChanges(changes, eds);
      if (changes.some(c => c.type === 'remove')) {
        // structural change -> update yaml
        setYamlValue(graphToYaml(nodes, updated));
      }
      return updated;
    });
  }, [nodes]);

  const onConnect = useCallback((connection: Connection) => {
    setEdges((eds) => {
      const updated = addEdge(connection, eds);
      setYamlValue(graphToYaml(nodes, updated));
      return updated;
    });
  }, [nodes]);

  return (
    <div className="app-container">
      <div className="header">
        <h1>CI/CD Pipeline Manager</h1>
        <div className="nav-tabs">
          <button className={activeTab === 'designer' ? 'active' : ''} onClick={() => setActiveTab('designer')}>Designer</button>
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
        </div>
      </div>
      <div className="content">
        {activeTab === 'designer' ? (
          <>
            <div className="panel canvas-panel">
              <PipelineCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                nodeTypes={nodeTypes}
              />
            </div>
            <div className="panel editor-panel">
              <YamlEditor value={yamlValue} onChange={(v) => setYamlValue(v || '')} />
            </div>
          </>
        ) : (
          <Dashboard />
        )}
      </div>
    </div>
  );
}

export default App;

