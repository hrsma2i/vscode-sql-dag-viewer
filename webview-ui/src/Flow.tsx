import React from 'react';
import { FromClause, JoinExpr, parse, SelectStmt, WithClause, Alias, BigQueryQuotedMemberExpr, Identifier, SubSelect, CompoundSelectStmt} from 'sql-parser-cst'
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

const getNamesFromTableExpr = (table_expr: Identifier | Alias | JoinExpr): string[] => {
  if (table_expr.type === "identifier") {
      const identifier = table_expr as Identifier
      return [identifier.name]
  } else if (table_expr.type === "alias") {
      const alias = table_expr as Alias

      let identifier: Identifier | null = null
      if (alias.expr.type === "bigquery_quoted_member_expr") {
          const bq_quated_member_expr = alias.expr as BigQueryQuotedMemberExpr
          identifier = bq_quated_member_expr.expr.property as Identifier
      } else if (alias.expr.type === "identifier") {
          identifier = alias.expr as Identifier
      } else {
          throw new Error(`Unexpected expr type: ${alias.expr.type}`)
      }

      return [identifier.name]
  } else if (table_expr.type === "join_expr") {
      const join_expr = table_expr as JoinExpr
      const left = join_expr.left as Alias | JoinExpr
      const right = join_expr.right as Alias | JoinExpr
      const left_nodes = getNamesFromTableExpr(left)
      const right_nodes = getNamesFromTableExpr(right)
      const nodes = left_nodes.concat(right_nodes)
      return nodes
  } else {
      return []
  }
}

const getParentsFromSubSelectStmt = (sub_select: SubSelect): string[] => {
  if (sub_select.type === "select_stmt") {
    const select_stmt = sub_select as SelectStmt
    const from_clause = select_stmt.clauses.filter(c => c.type === 'from_clause')[0] as FromClause
    const table_expr = from_clause.expr as unknown as Identifier | Alias | JoinExpr
    return getNamesFromTableExpr(table_expr)
  } else if (sub_select.type === "compound_select_stmt") {
    const compound_select_stmt = sub_select as CompoundSelectStmt
    const left = compound_select_stmt.left as SubSelect
    const right = compound_select_stmt.right as SubSelect
    const left_parents = getParentsFromSubSelectStmt(left)
    const right_parents = getParentsFromSubSelectStmt(right)
    return left_parents.concat(right_parents)
  } else {
    throw new Error(`Unexpected sub_select type: ${sub_select.type}`)
  }
}


const getNodesAndEdges = (sql: string): [Node[], Edge[]] => {
  console.log("parse SQL")
  const cst = parse(sql, {
    dialect: "bigquery",
    // These are optional:
    includeSpaces: true, // Adds spaces/tabs
    includeNewlines: true, // Adds newlines
    includeComments: true, // Adds comments
    includeRange: true, // Adds source code location data
  })
  console.log(`finished to parse SQL`)
  console.log(cst)

  const select_stmt = cst.statements.filter(s => s.type === 'select_stmt')[0] as SelectStmt
  const with_clause = select_stmt.clauses.filter(c => c.type === 'with_clause')[0] as WithClause

  const nodes: Node[] = []
  const edges: Edge[] = []

  with_clause.tables.items.forEach(cte => {
    const inner_sub_select = cte.expr.expr as SubSelect
    const parents = getParentsFromSubSelectStmt(inner_sub_select)

    const child = cte.table.name
    const childNode = { id: child, data: { label: child }, position: { x: 0, y: 0 } }
    if (!nodes.includes(childNode)) {
      nodes.push(childNode)
    }

    parents.forEach((parent) => {
      const parentNode = { id: parent, data: { label: parent }, position: { x: 0, y: 0 } }
      if (!nodes.includes(parentNode)) {
        nodes.push(parentNode)
      }
      edges.push({ id: `${parent}->${child}`, source: parent, target: child, animated: true })
    })
  })

  const mainName = '(main)'
  nodes.push({ id: mainName, data: { label: mainName }, position: { x: 0, y: 0 } })

  const parents = getParentsFromSubSelectStmt(select_stmt)
  parents.forEach((parent) => {
      const parentNode = { id: parent, data: { label: parent }, position: { x: 0, y: 0 } }
      if (!nodes.includes(parentNode)) {
        nodes.push(parentNode)
      }
      edges.push({ id: `${parent}->${mainName}`, source: parent, target: mainName, animated: true })
  })

  console.log("finished to convert CST to DAG nodes and edges")

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
    children: nodes.map((n) => ({id: n.id, width: 10 * n.id.length, height: 30})),
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

    return { id: child.id, data: {label: oldNode.data.label }, position: {x: child.x, y: child.y}, style: {width: child.width} }
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

      if (sql) {
        const [parsedNodes, parsedEdges] = getNodesAndEdges(sql)
        console.log("Update node positions")
        updateNodePosition(parsedNodes, parsedEdges).then((layoutedNodes) => {
          setNodes(layoutedNodes)
          setEdges(parsedEdges)

          window.requestAnimationFrame(() => {
            fitView()
          })
        })
        console.log("finished to update node positions")
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