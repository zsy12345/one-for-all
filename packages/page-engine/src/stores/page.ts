import { action, computed, makeObservable, observable, runInAction, toJS } from 'mobx';
import { cloneDeep, defaults, set } from 'lodash';

import { LoopNode, LoopNodeConf, ComposedNodeConf } from '../index';
import { elemId } from '../utils';
import { findNode, findParentId,
  removeNode as removeTreeNode, copyNode as copyTreeNode,
  replaceNode as replaceTreeNode } from '../utils/tree-utils';
import registry from './registry';
import dataSource from './data-source';
import type { DragPos, PageNode, PageSchema, SchemaElements, SourceElement } from '../types';
import { mapRawProps, mergeAsRenderEngineProps, transformLifecycleHooks } from '../utils/schema-adapter';
import { initPageSchema, deepMergeNode, generateGridChildren } from './page-helpers';

type Mode = 'design' | 'preview'

type AppendNodeOptions = {
  renewId?: boolean;
  from?: 'source' | 'canvas';
  [key: string]: any
}

class PageStore {
  @observable schema: PageSchema = initPageSchema()
  @observable mode: Mode = 'design'
  @observable activeElemId = ''
  @observable dragPos: DragPos = 'down'
  @observable schemaElements: Record<string, SchemaElements> = {}
  @observable parentNodes: string[] = [] // canvas cur node's parents

  constructor() {
    makeObservable(this);
  }

  @computed
  get rawActiveElem(): any {
    if (!this.activeElemId) {
      return null;
    }

    return findNode(this.schema.node, this.activeElemId, true);
  }

  @computed
  get activeElem(): any {
    // const node = this.rawActiveElem;
    // if (node?.type === 'loop-container') {
    //   if (node.node.type === 'composed-node') {
    //     const { outLayer, children = [] } = node.node;
    //     if (outLayer && (outLayer.id === this.activeElemId)) {
    //       return outLayer;
    //     }

    //     const currentNode = children.find((item: PageNode) => item.id === this.activeElemId);
    //     return currentNode;
    //   }

    //   return node.node;
    // }
    // return node;
    return findNode(this.schema.node, this.activeElemId);
  }

  @computed
  get activeElemProps(): any {
    return mapRawProps(this.activeElem?.props || {});
  }

  @computed
  get activeElemParents(): string[] {
    const parentIds: string[] = [];
    findParentId(toJS(this.schema.node), this.activeElemId, parentIds, toJS(this.schema.node));
    return parentIds;
  }

  findElement(id: string): any {
    if (!id) {
      return null;
    }
    return findNode(this.schema.node, id);
  }

  @action
  setSchema = (schema: PageSchema): void => {
    // ignore html node
    if (schema.node.type === 'html-element') {
      return;
    }

    this.schema = schema || initPageSchema();

    // init data source when set page schema
    runInAction(() => {
      dataSource.sharedState = dataSource.mapSharedStateSpec();
      dataSource.apiState = dataSource.mapApiStateSpec();
    });
  }

  @action
  setMode = (mode: Mode): void => {
    this.mode = mode;
  }

  @action
  setActiveElemId = (id: string): void => {
    this.activeElemId = id;
  }

  @action
  setDragPos = (pos: DragPos): void => {
    this.dragPos = pos;
  }

  @action
  appendNode = (node: Omit<PageNode, 'type' | 'id'>, target?: Omit<PageNode, 'type' | 'id'> | null, options?: AppendNodeOptions): void => {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const targetId = target?.id || this.schema.node.id;
    const targetNode = findNode(this.schema.node, targetId);

    const componentId = elemId(node.exportName);
    const params: Partial<PageNode> = {
      id: componentId,
      pid: this.dragPos === 'inner' ? targetNode.id : (targetNode.pid || this.schema.node.id),
      // exportName: node.exportName,
      type: 'react-component',
      packageName: 'ofa-ui',
      packageVersion: 'latest',
      props: mergeAsRenderEngineProps({}, {
        id: componentId, // Default mount ID
        ...(node.defaultConfig || {}),
      }),
    };

    if (registry.acceptChild(node.exportName)) {
      Object.assign(params, { children: [] });
      // check layout comps
      if (node.exportName === 'grid') {
        params.children = generateGridChildren(node, params.id || '').children;
      }
    }

    let srcNode = defaults(node, params);
    if (options?.renewId) {
      Object.assign(srcNode, { id: elemId(srcNode.exportName) });
    }

    // check if srcNode already in page
    const foundNode = findNode(this.schema.node, srcNode.id);
    if (foundNode) {
      srcNode = cloneDeep(foundNode);
    }

    if (targetNode) {
      // console.log('append node: ', toJS(srcNode), toJS(targetNode), this.dragPos);

      if (this.dragPos === 'up') {
        this.insertBefore(srcNode as PageNode, targetNode);
        return;
      }

      if (this.dragPos === 'inner') {
        if (!targetNode.children) {
          return;
        }
        if (srcNode.id && options?.from !== 'source') {
          const srcParent = findNode(this.schema.node, srcNode.pid);
          if (srcParent && srcParent.children) {
            const isLoopNode = srcNode.type === 'loop-container';
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            const srcNodeId = isLoopNode ? srcNode.node.id : srcNode.id;

            const idx = srcParent.children.findIndex((v: PageNode) => v.id === srcNodeId || v.id === srcNode.id);
            if (idx > -1) {
              // remove src node
              srcParent.children.splice(idx, 1);

              // append to target
              if (isLoopNode) {
                set(srcNode, 'node.pid', targetNode.id);
              }
              targetNode?.children?.push(Object.assign(srcNode, { pid: targetNode.id }));
            }
          }
        } else {
          // from source panel
          targetNode?.children?.push(Object.assign(srcNode, { pid: targetNode.id }));
        }
        return;
      }

      if (this.dragPos === 'down') {
        this.insertAfter(srcNode as PageNode, targetNode);
      }
    }
  }

  getRealNode = (rawNode: PageNode): PageNode => {
    return rawNode.type === 'loop-container' ? (rawNode as any).node : rawNode;
  }

  @action
  insertBefore = (rawNode: PageNode, target: PageNode): void => {
    const node = this.getRealNode(rawNode);
    const srcParent = findNode(this.schema.node, node.pid);
    const targetParent = findNode(this.schema.node, target.pid);
    let srcIdx = -1;
    let targetIdx = -1;

    if (srcParent && srcParent.children) {
      srcIdx = srcParent.children.findIndex((v: PageNode) => v.id === node.id || v.id === rawNode.id);
    }

    if (targetParent && targetParent.children) {
      targetIdx = targetParent.children.findIndex((v: PageNode) => v.id === target.id);
      if (srcIdx > -1 && targetIdx > -1) {
        // remove node from src parent
        srcParent.children.splice(srcIdx, 1);

        set(node, 'pid', targetParent.id);
        const newNode = Object.assign(rawNode, { pid: targetParent.id });
        if (targetIdx === 0) {
          targetParent.children.unshift(newNode);
        } else {
          targetParent.children.splice(targetIdx, 0, newNode);
        }
      }
    }
  }

  @action
  insertAfter = (rawNode: PageNode, target: PageNode): void => {
    const node = this.getRealNode(rawNode);
    const srcParent = findNode(this.schema.node, node.pid);
    const targetParent = findNode(this.schema.node, target.pid);
    let srcIdx = -1; // node in src parent idx
    let targetIdx = -1; // node in target parant idx

    if (srcParent && srcParent.children) {
      srcIdx = srcParent.children.findIndex((v: PageNode) => v.id === node.id || v.id === rawNode.id);
    }

    if (!target.pid) {
      removeTreeNode(this.schema.node, node.id);
      // append to page
      set(node, 'pid', targetParent.id);
      targetParent.children.push(Object.assign(rawNode, { pid: targetParent.id }));
      return;
    }

    if (targetParent && targetParent.children) {
      targetIdx = targetParent.children.findIndex((v: PageNode) => v.id === target.id);
      if (srcIdx > -1 && targetIdx > -1) {
        // remove node in src parent
        srcParent.children.splice(srcIdx, 1);

        // add node in target parent, double check node pid
        set(node, 'pid', targetParent.id);
        targetParent.children.splice(targetIdx + 1, 0, Object.assign(rawNode, { pid: targetParent.id }));
      }
    }
  }

  @action
  copyNode = (id: string): void => {
    const srcNode = findNode(this.schema.node, this.activeElemId, true);

    if (srcNode.type === 'loop-container') {
      if (srcNode.node && srcNode.node.type === 'composed-node') {
        const { children, outLayer } = srcNode.node;
        if (outLayer.id !== id) {
          let _oldNode = {} as PageNode;
          (children || []).map((child: PageNode) => {
            if (child.id === id) {
              _oldNode = child;
            }
            return child;
          });
          if (_oldNode.id) {
            copyTreeNode(this.schema.node, id, deepMergeNode(_oldNode));
            return;
          }
        }
      }
    }

    copyTreeNode(this.schema.node, id, deepMergeNode(srcNode));
  }

  @action
  removeNode = (id: string): void => {
    removeTreeNode(this.schema.node, id);
    this.activeElemId = '';
  }

  @action
  updateElemProperty = (elem_id: string, propKey: string, conf: any, options?: Record<string, any>): void => {
    const elem = findNode(this.schema.node, elem_id, true);
    if (elem) {
      let actualNode = elem;
      if (!options?.useRawNode && elem.type === 'loop-container') {
        // support composed-node
        if (elem.node.type === 'composed-node') {
          const { outLayer, children } = toJS(elem.node);
          if (outLayer && outLayer.id === this.activeElemId) {
            actualNode = outLayer;
          }

          if (children && outLayer.id !== this.activeElemId) {
            actualNode = children.find((item: PageNode) => item.id === this.activeElemId);
          }
        } else {
          actualNode = toJS(elem.node);
        }
      }

      // console.log('update node props: ', elem_id, toJS(actualNode), propKey, conf);

      if (propKey === 'props') {
        set(actualNode, propKey, mergeAsRenderEngineProps(toJS(this.activeElem?.props), conf));
        if (actualNode.exportName && actualNode.exportName === 'grid') {
          set(actualNode, 'children', generateGridChildren(toJS(actualNode), actualNode.id, conf).children);
        }
      } else if (propKey === 'props.style') {
        // fixme: style bind variable
        set(actualNode, propKey, { type: 'constant_property', value: conf });
      } else if (propKey === 'lifecycleHooks') {
        set(actualNode, propKey, transformLifecycleHooks(conf));
      } else {
        set(actualNode, propKey, conf);
      }
    }
  }

  getElemBoundActions = (): string[] => {
    const elemConf = registry.getElemByType(this.activeElem?.exportName) as SourceElement<any>;
    return ['didMount', 'willUnmount'].concat(elemConf?.exportActions || []);
  }

  @action
  replaceNode = (node_id: string, replaced: PageNode): void => {
    // const parent = findParent(this.schema.node, node_id);
    // if (parent) {
    //   const srcIdx = parent.children?.findIndex((v) => v.id === node_id || get(v, 'node.id') === node_id) ?? -1;
    //   console.log(srcIdx);
    //   if (srcIdx > -1) {
    //     parent.children?.splice(srcIdx, 1, replaced);
    //   }
    // }
    const srcNode = findNode(this.schema.node, this.activeElemId, true);

    if (srcNode.type === 'loop-container') {
      if (srcNode.node && srcNode.node.type === 'composed-node') {
        const { children, outLayer } = srcNode.node;
        if (outLayer.id !== node_id) {
          let _oldNode = {} as PageNode;
          (children || []).map((child: PageNode) => {
            if (child.id === node_id) {
              _oldNode = child;
            }
            return child;
          });
          if (_oldNode.id) {
            replaceTreeNode(this.schema.node, node_id, replaced);
            return;
          }
        }
      }
    }

    replaceTreeNode(this.schema.node, node_id, replaced);
  }

  @action
  setNodeAsLoopContainer = (node_id: string, loopConfig: Partial<LoopNodeConf>): void => {
    // wrap normal node as loop node
    const target = findNode(this.schema.node, node_id);
    if (!target) {
      return;
    }
    const nodeCopy = cloneDeep(target);
    const loopNodeConfig = {
      id: elemId('loop-node'),
      type: 'loop-container',
      node: nodeCopy,
      loopKey: loopConfig.loopKey || 'id',
      toProps: {
        args: 'state',
        body: loopConfig.toProps || 'return state',
        type: 'to_props_function_spec',
      },
      iterableState: loopConfig.iterableState || {},
    };

    // console.log('set loop node: ', loopNodeConfig);
    this.replaceNode(node_id, loopNodeConfig as any);
  }

  @action
  updateCurNodeAsLoopContainer = (propKey: string, confItem: any): void => {
    if (!this.rawActiveElem?.iterableState) {
      // replace current normal node to loop node
      this.setNodeAsLoopContainer(this.activeElemId, { [propKey]: confItem });
    } else {
      // update loop node iterable state config
      this.updateElemProperty(this.activeElemId, propKey, propKey === 'toProps' ? {
        args: 'state',
        body: confItem || 'return state',
        type: 'to_props_function_spec',
      } : confItem, { useRawNode: true });
    }
  }

  @action
  unsetLoopNode = (loop_node_id: string): void => {
    // reset loop container, lift up inner node
    const loopNode = findNode(this.schema.node, loop_node_id, true);
    if (!loopNode) {
      return;
    }
    if (loopNode.type === 'loop-container') {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const innerNode = (loopNode as LoopNode).node;
      this.replaceNode(loop_node_id, innerNode as PageNode);
    }
  }

  @action
  reset = (): void => {
    this.schema = initPageSchema();
    this.mode = 'design';
    this.activeElemId = '';
    this.dragPos = 'down';
  }

  @action
  setSchemaElements = (elements: Record<string, SchemaElements>): void => {
    this.schemaElements = elements;
  }

  // todo: deprecate
  @action
  setParentNodes = (node_ids: string[]): void => {
    this.parentNodes = node_ids;
  }

  @action
  setNodeAsComposedNode = (node_id: string, composedConfig: Partial<ComposedNodeConf>): void => {
    // wrap normal node as loop node
    const target = findNode(this.schema.node, node_id);
    if (!target) {
      return;
    }
    // const nodeCopy = cloneDeep(target);
    const composedNodeConfig = {
      id: elemId('loop-node'),
      props: {},
      type: 'loop-container',
      // node: nodeCopy,
      loopKey: composedConfig.loopKey || 'id',
      iterableState: composedConfig.iterableState || {},
      node: composedConfig.node || {},
    };

    // console.log('set loop node: ', composedNodeConfig);
    this.replaceNode(node_id, composedNodeConfig as any);
  }

  @action
  updateCurNodeAsComposedNode = (propKey: string, confItem: any): void => {
    // if (!this.rawActiveElem.iterableState) {
    //   // replace current normal node to loop node
    //   this.setNodeAsComposedNode(this.activeElemId, confItem);
    // } else {
    //   // todo: update
    //   this.updateElemProperty(this.activeElemId, propKey, propKey === 'toProps' ? {
    //     args: 'state',
    //     body: confItem || 'return state',
    //     type: 'to_props_function_spec',
    //   } : confItem, { useRawNode: true });
    // }
    this.setNodeAsComposedNode(this.activeElemId, confItem);
  }

  @action
  unsetComposedNode = (loop_node_id: string): void => {
    // reset loop container, lift up inner node
    const composedNode = findNode(this.schema.node, loop_node_id, true);
    if (!composedNode) {
      return;
    }
    if (composedNode.type === 'loop-container') {
      const { node } = composedNode;
      if (node) {
        const { outLayer, children } = node as PageNode;
        if (outLayer) {
          const newNode = { ...outLayer };
          newNode.children = children;
          this.replaceNode(loop_node_id, newNode as PageNode);
        }
      }
      // const innerNode = (loopNode as LoopNode).node;
      // this.replaceNode(loop_node_id, innerNode as PageNode);
    }
  }
}

export default new PageStore();
