import React, { useCallback, useEffect, useRef } from 'react';
import cs from 'classnames';
import { observer } from 'mobx-react';
import { debounce } from 'lodash';

import { Panel } from '@ofa/ui';
import { useCtx } from '@ofa/page-engine';

import Group from './group';
import { groups, panelTitle } from './config';
import PlatformComps from './platform-comps';
import PageTree from './page-tree';
import CustomTemplate from './custom-template';
import DataSource from './data-source';

import styles from './index.m.scss';

function SourcePanel(): JSX.Element {
  const store = useCtx().designer;
  const panelRef = useRef<HTMLDivElement>(null);
  const hoverDoc = useCallback(debounce(handleClickOutside, 200), []);

  useEffect(() => {
    document.addEventListener('mouseover', hoverDoc);
    return () => {
      document.removeEventListener('mouseover', hoverDoc);
    };
  }, []);

  function handleClickOutside(ev: any): void {
    if (!panelRef.current?.contains(ev.target) && !store.panelPinned) {
      store.setPanelOpen(false);
    }
  }

  function renderPanelCont(): JSX.Element | null {
    if (store.activeGroup === 'comps') {
      return <PlatformComps />;
    }
    if (store.activeGroup === 'templates') {
      return <CustomTemplate />;
    }
    if (store.activeGroup === 'page_tree') {
      return <PageTree />;
    }
    if (store.activeGroup === 'data_source') {
      return <DataSource />;
    }
    return null;
  }

  return (
    <div className='flex relative' ref={panelRef}>
      <div className={cs(styles.sourcePanel, 'flex flex-col items-center relative')}>
        {groups.map((gp) => {
          return (
            <Group
              {...gp}
              key={gp.name}
              active={store.activeGroup === gp.name}
              onHover={() => {
                store.setActiveGroup(gp.name);
                store.setPanelOpen(true);
              }}
            />
          );
        })}
      </div>
      <Panel
        title={panelTitle[store.activeGroup]}
        style={{ transform: 'translateX(55px)' }}
        onClose={() => store.setPanelOpen(false)}
        onPin={() => store.setPanelPinned(!store.panelPinned)}
        visible={store.panelOpen}
        pinned={store.panelPinned}
        closable
        pinnable
      >
        {renderPanelCont()}
      </Panel>
    </div>

  );
}

export default observer(SourcePanel);
