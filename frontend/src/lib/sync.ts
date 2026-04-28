import type { Node, Edge } from 'reactflow';
import yaml from 'js-yaml';
import dagre from 'dagre';
import { Position } from 'reactflow';

const nodeWidth = 200;
const nodeHeight = 100;

export function getLayoutedElements(nodes: Node[], edges: Edge[], direction = 'LR') {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));
  
  dagreGraph.setGraph({ rankdir: direction, ranksep: 120, nodesep: 60 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  return nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      targetPosition: direction === 'LR' ? Position.Left : Position.Top,
      sourcePosition: direction === 'LR' ? Position.Right : Position.Bottom,
    };
  });
}

export function yamlToGraph(yamlString: string): { nodes: Node[]; edges: Edge[] } {
  try {
    const doc: any = yaml.load(yamlString);
    if (!doc || !doc.stages) return { nodes: [], edges: [] };
    
    let nodes: Node[] = [];
    let edges: Edge[] = [];

    Object.entries(doc.stages).forEach(([key, stage]: [string, any]) => {
      nodes.push({
        id: key,
        type: 'stageNode',
        position: { x: 0, y: 0 },
        data: { label: key, type: stage.type || 'build', script: stage.script }
      });

      if (stage.depends_on) {
        const deps = Array.isArray(stage.depends_on) ? stage.depends_on : [stage.depends_on];
        deps.forEach((dep: any) => {
          edges.push({ id: `e-${dep}-${key}`, source: String(dep), target: key });
        });
      }
    });

    nodes = getLayoutedElements(nodes, edges, 'LR');

    return { nodes, edges };
  } catch (e) {
    console.error('YAML parse error', e);
    return { nodes: [], edges: [] };
  }
}

export function graphToYaml(nodes: Node[], edges: Edge[]): string {
  const doc: any = { name: "Generated Pipeline", stages: {} };
  
  nodes.forEach(node => {
    const deps = edges.filter(e => e.target === node.id).map(e => e.source);
    doc.stages[node.id] = {
      type: node.data.type || 'build',
      script: node.data.script || 'echo "hello"',
    };
    if (deps.length > 0) {
      doc.stages[node.id].depends_on = deps.length === 1 ? deps[0] : deps;
    }
  });

  return yaml.dump(doc);
}
