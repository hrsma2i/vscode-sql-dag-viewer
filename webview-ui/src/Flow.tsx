import React, { useCallback } from 'react';
import ReactFlow, {
  ReactFlowProvider,
  Panel,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

export const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'input' },
    position: { x: 0, y: 0 },
  },
  {
    id: '2',
    data: { label: 'node 2' },
    position: { x: 0, y: 100 },
  },
  {
    id: '2a',
    data: { label: 'node 2a' },
    position: { x: 0, y: 200 },
  },
  {
    id: '2b',
    data: { label: 'node 2b' },
    position: { x: 0, y: 300 },
  },
  {
    id: '2c',
    data: { label: 'node 2c' },
    position: { x: 0, y: 400 },
  },
  {
    id: '2d',
    data: { label: 'node 2d' },
    position: { x: 0, y: 500 },
  },
  {
    id: '3',
    data: { label: 'node 3' },
    position: { x: 200, y: 100 },
  },
];

export const initialEdges = [
  { id: 'e12', source: '1', target: '2', animated: true },
  { id: 'e13', source: '1', target: '3', animated: true },
  { id: 'e22a', source: '2', target: '2a', animated: true },
  { id: 'e22b', source: '2', target: '2b', animated: true },
  { id: 'e22c', source: '2', target: '2c', animated: true },
  { id: 'e2c2d', source: '2c', target: '2d', animated: true },
];


const useLayoutedElements = () => {
  const { getNodes, setNodes, getEdges, fitView } = useReactFlow();
  const defaultOptions = {
    'elk.algorithm': 'layered',
    'elk.layered.spacing.nodeNodeBetweenLayers': 100,
    'elk.spacing.nodeNode': 80,
  };

  const getLayoutedElements = useCallback((options) => {
    const layoutOptions = { ...defaultOptions, ...options };
    const nodes = getNodes();
    const graph = {
      id: 'root',
      layoutOptions: layoutOptions,
      children: nodes.map((n) => ({id: n.id, width: 100, height: 30})),
      edges: getEdges().map((e) => ({id: e.id, sources: [e.source], targets: [e.target]})),
    };

    elk.layout(graph).then(({ children }) => {
      // By mutating the children in-place we saves ourselves from creating a
      // needless copy of the nodes array.
      children?.forEach((child) => {
        const node = nodes.filter((n) => n.id === child.id)?.[0]
        if (child.x && child.y && node) {
          node.position = { x: child.x, y: child.y };
        }
      });

      setNodes(nodes);
      window.requestAnimationFrame(() => {
        fitView();
      });
    });
  }, []);

  return { getLayoutedElements };
};

const LayoutFlow = () => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);
  const { getLayoutedElements } = useLayoutedElements();

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
        <Panel position="top-right">
          <button
            onClick={() =>
              getLayoutedElements({ 'elk.algorithm': 'layered', 'elk.direction': 'DOWN' })
            }
          >
            vertical layout
          </button>
          <button
            onClick={() =>
              getLayoutedElements({ 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT' })
            }
          >
            horizontal layout
          </button>
          <button
            onClick={() =>
              getLayoutedElements({
                'elk.algorithm': 'org.eclipse.elk.radial',
              })
            }
          >
            radial layout
          </button>
          <button
            onClick={() =>
              getLayoutedElements({
                'elk.algorithm': 'org.eclipse.elk.force',
              })
            }
          >
            force layout
          </button>
        </Panel>
      </ReactFlow>
    </div>
  );
};

export default function () {
  return (
    <ReactFlowProvider>
      <LayoutFlow />
    </ReactFlowProvider>
  );
}