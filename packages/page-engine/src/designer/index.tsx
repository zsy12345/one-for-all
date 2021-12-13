import React, { useEffect } from 'react';
import cs from 'classnames';
import { observer } from 'mobx-react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { configure } from 'mobx';

import Toolbar from './toolbar';
import SourcePanel from './source-panel';
import SettingPanel from './setting-panel';
import Page from '../core/page';
import Ctx from '../ctx';
import stores from '../stores';

import styles from './index.m.scss';

interface Props {
  onSave: (page_schema: PageEngine.Node) => void;
  onPreview: (page_schema: PageEngine.Node) => void;
  title: React.ReactNode;
  apis: Record<string, PageEngine.ApiItem>;
  className?: string;
}

// https://mobx.js.org/configuration.html#isolateglobalstate-boolean
configure({ isolateGlobalState: true });

function Designer({ className, title = 'qxp page engine', onSave, onPreview, apis }: Props): JSX.Element | null {
  const { designer } = stores;

  useEffect(() => {
    // set page title
    designer.setPageTitle(title);

    // attach external props to ctx
    Object.assign(stores, {
      onSave,
      onPreview,
      apis,
    });

    // for dev mode
    // @ts-ignore
    window._ctx = stores;

    return () => {
      // reset ctx
      Object.entries(stores).forEach(([, store]: [string, any]) => {
        if (typeof store?.reset === 'function') {
          store.reset();
        }
      });
    };
  }, []);

  return (
    <DndProvider backend={HTML5Backend}>
      <Ctx.Provider value={stores}>
        <div className={cs(styles.designer, className)}>
          <Toolbar />
          <div className={cs(styles.body, {
            [styles.pinned]: designer.panelOpen && designer.panelPinned,
          })}>
            <SourcePanel />
            <Page className={cs('my-8', styles.canvas)} />
            <SettingPanel />
          </div>
        </div>
      </Ctx.Provider>
    </DndProvider>
  );
}

export default observer(Designer);
