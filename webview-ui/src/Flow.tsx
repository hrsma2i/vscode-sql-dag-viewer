import React from 'react';
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

const getNodesAndEdges = (sql: string): [Node[], Edge[]] => {
  const parser = new Parser()
  const ast = parser.astify(sql, {database: 'BigQuery'}) as Select

  const nodes: Node[] = []
  const edges: Edge[] = []

  ast.with?.forEach((cte) => {
    const child = cte.name.value
    const childNode = { id: child, data: { label: child }, position: { x: 0, y: 0 } }
    if (!nodes.includes(childNode)) {
      nodes.push(childNode)
    }

    cte.stmt.ast.from?.forEach((f) => {
      const parent = f.table!
      const parentNode = { id: parent, data: { label: parent }, position: { x: 0, y: 0 } }
      if (!nodes.includes(parentNode)) {
        nodes.push(parentNode)
      }
      edges.push({ id: `${parent}->${child}`, source: parent, target: child, animated: true })
    })
  })

  const mainName = '(main)'
  nodes.push({ id: mainName, data: { label: mainName }, position: { x: 0, y: 0 } })

  ast.from?.forEach((f) => {
      const parent = f.table!
      const parentNode = { id: parent, data: { label: parent }, position: { x: 0, y: 0 } }
      if (!nodes.includes(parentNode)) {
        nodes.push(parentNode)
      }
      edges.push({ id: `${parent}->${mainName}`, source: parent, target: mainName, animated: true })
  })

  return [ nodes, edges ]
}

const updateNodePosition = async (nodes: Node[], edges: Edge[]): Promise<Node[]> => {
  const defaultOptions = {
    'elk.algorithm': 'layered',
    'elk.direction': 'DOWN',
    'elk.layered.spacing.nodeNodeBetweenLayers': 100,
    'elk.spacing.nodeNode': 80,
  } as any;

  const graph = {
    id: 'root',
    layoutOptions: defaultOptions,
    children: nodes.map((n) => ({id: n.id, width: 100, height: 30})),
    edges: edges.map((e) => ({id: e.id, sources: [e.source], targets: [e.target]})),
  };

  const { children } = await elk.layout(graph)

  const newNodes = children?.map((child) => {
    if (!child.id) {
      return null
    }

    const oldNode = nodes.filter((n) => n.id === child.id)?.[0]

    if (!child.x || !child.y) {
      return oldNode
    }

    return { id: child.id, data: {label: oldNode.data.label }, position: {x: child.x, y: child.y} }
  }).filter((x) => x !== null) as Node[]

  return newNodes
}

const LayoutFlow = () => {

  const { setNodes, setEdges, fitView } = useReactFlow();
  const [nodes, , onNodesChange] = useNodesState([]);
  const [edges, , onEdgesChange] = useEdgesState([]);

  React.useEffect(() => {
    console.log("useEffect called")
    const messageHandler = (event: any) => {
      const sql = event.data?.sql;
      console.log(`sql: ${sql}`)

      if (sql) {
        const [parsedNodes, parsedEdges] = getNodesAndEdges(sql)
        updateNodePosition(parsedNodes, parsedEdges).then((layoutedNodes) => {
          setNodes(layoutedNodes)
          setEdges(parsedEdges)

          window.requestAnimationFrame(() => {
            fitView()
          })
        })
      }
    };

    window.addEventListener('message', messageHandler);

    return () => {
        window.removeEventListener('message', messageHandler);
    };
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