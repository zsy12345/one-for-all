import React, { useContext } from 'react';
import cs from 'classnames';
import { useRecoilState } from 'recoil';

import useContourNodeStyle from './use-active-contour-node-style';
import { ArteryCtx } from '../contexts';
import type { ContourNode } from '../types';
import {
  cursor$,
  draggingNodeIDState,
  hoveringContourNode$,
  hoveringParentIDState,
  onDropEvent$,
} from '../atoms';
import { overrideDragImage } from '../utils';
import useSetActiveNode from './use-set-active-node';
import useShouldHandleDndCallback from './use-should-handle-dnd-callback';

function preventDefault(e: any): false {
  e.preventDefault();
  e.stopPropagation();
  return false;
}

interface Props {
  contourNode: ContourNode;
}

function RenderContourNode({ contourNode }: Props): JSX.Element {
  const [hoveringParentID] = useRecoilState(hoveringParentIDState);
  const { rootNodeID, activeNode } = useContext(ArteryCtx);
  const style = useContourNodeStyle(contourNode);
  const [draggingNodeID, setDraggingNodeID] = useRecoilState(draggingNodeIDState);
  const setActiveNode = useSetActiveNode();
  const _shouldHandleDnd = useShouldHandleDndCallback(contourNode.id);

  return (
    <>
      <div
        id={`contour-${contourNode.id}`}
        style={style}
        onClick={() => setActiveNode(contourNode.id)}
        draggable={contourNode.id !== rootNodeID}
        onDragStart={(e: React.DragEvent<HTMLDivElement>): any => {
          // todo this has no affect, fix it!
          e.dataTransfer.effectAllowed = 'move';
          e.dataTransfer.setData('SIMULATOR_DRAGGING_NODE_ID', contourNode.id);
          setDraggingNodeID(contourNode.id);

          overrideDragImage(e.dataTransfer);
        }}
        onDragEnd={() => setDraggingNodeID(undefined)}
        onDragOver={(e) => {
          if (!_shouldHandleDnd()) {
            return;
          }

          preventDefault(e);
          cursor$.next({ x: e.clientX, y: e.clientY });
        }}
        onDrag={preventDefault}
        onDragEnter={(e: React.DragEvent<HTMLDivElement>): any => {
          if (!_shouldHandleDnd()) {
            return;
          }

          hoveringContourNode$.next(contourNode);

          preventDefault(e);
          return false;
        }}
        onDrop={(e: React.DragEvent<HTMLDivElement>): any => {
          preventDefault(e);
          onDropEvent$.next(e);
          // handleDrop(e);
          return false;
        }}
        className={cs('contour-node', {
          'contour-node--root': rootNodeID === contourNode.id,
          'contour-node--active': activeNode?.id === contourNode.id,
          'contour-node--hover-as-parent': hoveringParentID === contourNode.id,
          'contour-node--dragging': draggingNodeID === contourNode.id,
        })}
      />
    </>
  );
}

export default RenderContourNode;
