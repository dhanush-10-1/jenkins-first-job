import { useState, useEffect, useCallback, useMemo } from 'react';
import { PipelineCanvas } from './components/PipelineCanvas';
import { YamlEditor } from './components/YamlEditor';
import { BlockPalette } from './components/BlockPalette';
import { NodeEditor } from './components/NodeEditor';
import { yamlToGraph, graphToYaml, sanitizeStageKey } from './lib/sync';
import { StageNode } from './components/CustomNodes';
import { addEdge, applyNodeChanges, applyEdgeChanges } from 'reactflow';
import type { Node, Edge, Connection, NodeChange, EdgeChange } from 'reactflow';
import './index.css';

import { Dashboard } from './components/Dashboard';
import { RepoManager } from './components/RepoManager';

const initialYaml = `name: My Pipeline
stages:
  source-trigger:
    type: trigger
    script: git clone $REPO_URL && git checkout $BRANCH
  build:
    type: build
    depends_on: source-trigger
    script: docker build -t app .
  test:
    type: test
    depends_on: build
    script: npm test
  security-scan:
    type: security
    depends_on: build
    script: trivy image app:latest
  deploy:
    type: deploy
    depends_on:
      - test
      - security-scan
    script: kubectl apply -f deploy.yaml
`;

function App() {
  const [activeTab, setActiveTab] = useState('designer');
  const [yamlValue, setYamlValue] = useState(initialYaml);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);

  const nodeTypes = useMemo(() => ({ stageNode: StageNode }), []);

  // YAML → Graph sync (only when YAML changes from the editor)
  useEffect(() => {
    const { nodes: newNodes, edges: newEdges } = yamlToGraph(yamlValue);
    setNodes(newNodes);
    setEdges(newEdges);
  }, [yamlValue]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const updated = applyNodeChanges(changes, nds);
      if (changes.some(c => c.type === 'remove')) {
        setYamlValue(graphToYaml(updated, edges));
      }
      return updated;
    });
  }, [edges]);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((eds) => {
      const updated = applyEdgeChanges(changes, eds);
      if (changes.some(c => c.type === 'remove')) {
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

  // --- Click node to open editor ---
  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node);
  }, []);

  // --- Update node data from the editor ---
  const onNodeUpdate = useCallback((id: string, data: Record<string, any>) => {
    setNodes((nds) => {
      const updated = nds.map((n) => {
        if (n.id !== id) return n;
        // If label changed, we need to update the node ID for YAML key consistency
        const newKey = sanitizeStageKey(data.label);
        return {
          ...n,
          id: newKey,
          data: { ...n.data, ...data, label: data.label },
        };
      });
      // Also update edge references if the ID changed
      const oldNode = nds.find((n) => n.id === id);
      const newKey = sanitizeStageKey(data.label);
      if (oldNode && oldNode.id !== newKey) {
        setEdges((eds) => {
          const updatedEdges = eds.map((e) => ({
            ...e,
            id: e.id.replace(id, newKey),
            source: e.source === id ? newKey : e.source,
            target: e.target === id ? newKey : e.target,
          }));
          setYamlValue(graphToYaml(updated, updatedEdges));
          return updatedEdges;
        });
      } else {
        setYamlValue(graphToYaml(updated, edges));
      }
      return updated;
    });
    setSelectedNode(null);
  }, [edges]);

  // --- Delete node from editor ---
  const onNodeDelete = useCallback((id: string) => {
    setNodes((nds) => {
      const updated = nds.filter((n) => n.id !== id);
      setEdges((eds) => {
        const updatedEdges = eds.filter((e) => e.source !== id && e.target !== id);
        setYamlValue(graphToYaml(updated, updatedEdges));
        return updatedEdges;
      });
      return updated;
    });
    setSelectedNode(null);
  }, []);

  // --- Drop new block from palette onto canvas ---
  const onDropNode = useCallback(
    (type: string, label: string, script: string, position: { x: number; y: number }) => {
      const key = sanitizeStageKey(label) + '_' + Date.now().toString(36).slice(-4);
      const newNode: Node = {
        id: key,
        type: 'stageNode',
        position,
        data: { label: key, type, script },
      };
      setNodes((nds) => {
        const updated = [...nds, newNode];
        setYamlValue(graphToYaml(updated, edges));
        return updated;
      });
    },
    [edges]
  );

  return (
    <div className="app-container">
      <div className="header">
        <h1>CI/CD Pipeline Manager</h1>
        <div className="nav-tabs">
          <button className={activeTab === 'designer' ? 'active' : ''} onClick={() => setActiveTab('designer')}>Designer</button>
          <button className={activeTab === 'dashboard' ? 'active' : ''} onClick={() => setActiveTab('dashboard')}>Dashboard</button>
          <button className={activeTab === 'repos' ? 'active' : ''} onClick={() => setActiveTab('repos')}>Repos</button>
        </div>
      </div>
      <div className="content">
        {activeTab === 'designer' ? (
          <>
            <BlockPalette />
            <div className="panel canvas-panel">
              <PipelineCanvas
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeClick={onNodeClick}
                onDropNode={onDropNode}
                nodeTypes={nodeTypes}
              />
            </div>
            <div className="panel editor-panel">
              <YamlEditor value={yamlValue} onChange={(v) => setYamlValue(v || '')} />
            </div>
          </>
        ) : activeTab === 'dashboard' ? (
          <Dashboard />
        ) : (
          <RepoManager />
        )}
      </div>

      {/* Node Editor Modal */}
      {selectedNode && (
        <NodeEditor
          key={selectedNode.id}
          node={selectedNode}
          onUpdate={onNodeUpdate}
          onDelete={onNodeDelete}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

export default App;
