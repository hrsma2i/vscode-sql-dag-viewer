import React, { useCallback } from 'react';
import { Parser, From } from "node-sql-parser";
import ReactFlow, {
  ReactFlowProvider,
  useNodesState,
  useEdgesState,
  useReactFlow,
  Node,
  Edge,
} from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';

const elk = new ELK();

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


type With = {
  name: {
    value: string
  };
  stmt: {
    ast: Select
  };
}

type Select = {
  with: Array<With> | null;
  from: Array<From> | null;
}

const LayoutFlow = () => {
  const parser = new Parser()
  const sql = `
    with
      b as (
        select *
        from a
      )
      , c as (
        select *
        from b
      )
      , e as (
        select *
        from d
      )

    select *
    from c
      join e
        on c.id = e.id
  `

  const ast = parser.astify(sql) as Select

  const initNodes: Node[] = []
  const initEdges: Edge[] = []

  ast.with?.forEach((cte) => {
    const child = cte.name.value
    const childNode = { id: child, data: { label: child }, position: { x: 0, y: 0 } }
    if (!initNodes.includes(childNode)) {
      initNodes.push(childNode)
    }

    cte.stmt.ast.from?.forEach((f) => {
      const parent = f.table!
      const parentNode = { id: parent, data: { label: parent }, position: { x: 0, y: 0 } }
      if (!initNodes.includes(parentNode)) {
        initNodes.push(parentNode)
      }
      initEdges.push({ id: `${parent}->${child}`, source: parent, target: child, animated: true })
    })
  })

  const mainName = '(main)'
  initNodes.push({ id: mainName, data: { label: mainName }, position: { x: 0, y: 0 } })

  ast.from?.forEach((f) => {
      const parent = f.table!
      const parentNode = { id: parent, data: { label: parent }, position: { x: 0, y: 0 } }
      if (!initNodes.includes(parentNode)) {
        initNodes.push(parentNode)
      }
      initEdges.push({ id: `${parent}->${mainName}`, source: parent, target: mainName, animated: true })
  })

  const [nodes, , onNodesChange] = useNodesState(initNodes);
  const [edges, , onEdgesChange] = useEdgesState(initEdges);
  const { getLayoutedElements } = useLayoutedElements();

  React.useEffect(() => {
    getLayoutedElements({ 'elk.algorithm': 'layered', 'elk.direction': 'DOWN' })
  }, []);

  return (
    <div style={{ height: '100vh', width: '100vw' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
      >
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