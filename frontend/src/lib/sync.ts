import { Node, Edge } from 'reactflow';
import yaml from 'js-yaml';

export function yamlToGraph(yamlString: string): { nodes: Node[]; edges: Edge[] } {
  try {
    const doc: any = yaml.load(yamlString);
    if (!doc || !doc.stages) return { nodes: [], edges: [] };
    
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let yOffset = 50;

    Object.entries(doc.stages).forEach(([key, stage]: [string, any], index) => {
      nodes.push({
        id: key,
        type: 'stageNode',
        position: { x: 250, y: yOffset },
        data: { label: key, type: stage.type || 'build', script: stage.script }
      });
      yOffset += 100;

      if (stage.depends_on) {
        const deps = Array.isArray(stage.depends_on) ? stage.depends_on : [stage.depends_on];
        deps.forEach(dep => {
          edges.push({ id: `e-${dep}-${key}`, source: String(dep), target: key });
        });
      }
    });

    return { nodes, edges };
  } catch (e) {
    console.error('YAML parse error', e);
    return { nodes: [], edges: [] }; // Return empty or previous state
  }
}

export function graphToYaml(nodes: Node[], edges: Edge[]): string {
  const doc: any = { stages: {} };
  
  nodes.forEach(node => {
    const deps = edges.filter(e => e.target === node.id).map(e => e.source);
    doc.stages[node.id] = {
      type: node.data.type,
      script: node.data.script || 'echo "hello"',
    };
    if (deps.length > 0) {
      doc.stages[node.id].depends_on = deps;
    }
  });

  return yaml.dump(doc);
}
