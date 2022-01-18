import React, { useContext } from 'react';
import { logger } from '@ofa/utils';

import PathContext from './path-context';
import RefNodeRender from './ref-node-render';
import HTMLNodeRender from './html-node-render';
import LoopNodeRender from './loop-node-render';
import { CTX, SchemaNode } from '../types';
import ReactComponentNodeRender from './react-component-node-render';
import { useShouldRender } from './hooks';

type ChildrenRenderProps = {
  nodes: SchemaNode[];
  ctx: CTX;
}

export function ChildrenRender(
  { nodes, ctx }: ChildrenRenderProps,
): React.FunctionComponentElement<Record<string, unknown>> | null {
  if (!nodes.length) {
    return null;
  }

  return React.createElement(
    React.Fragment,
    null,
    nodes.map((node) => React.createElement(NodeRender, { key: node.id, node: node, ctx })),
  );
}

type Props = {
  node: SchemaNode;
  ctx: CTX;
}

function NodeRender({ node, ctx }: Props): React.ReactElement | null {
  const parentPath = useContext(PathContext);
  const currentPath = `${parentPath}/${node.id}`;
  const shouldRender = useShouldRender(node, ctx);

  if (!shouldRender) {
    return null;
  }

  if (node.type === 'loop-container') {
    return React.createElement(
      PathContext.Provider,
      { value: currentPath },
      React.createElement(LoopNodeRender, { node, ctx }),
    );
  }

  if (node.type === 'html-element') {
    return React.createElement(
      PathContext.Provider,
      { value: currentPath },
      React.createElement(HTMLNodeRender, { node, ctx }),
    );
  }

  if (node.type === 'react-component') {
    return React.createElement(
      PathContext.Provider,
      { value: currentPath },
      React.createElement(ReactComponentNodeRender, { node, ctx }),
    );
  }

  if (node.type === 'ref-node') {
    return React.createElement(
      PathContext.Provider,
      { value: currentPath },
      React.createElement(RefNodeRender, { node, ctx }),
    );
  }

  logger.error('Unrecognized node type of node:', node);
  return null;
}

export default NodeRender;
