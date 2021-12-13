import { observable, action, makeObservable } from 'mobx';

type SettingPanel = 'props' | 'style' | 'event' | 'renderer'

class DesignerStore {
  @observable activeGroup = ''
  @observable panelOpen = false
  @observable panelPinned = false
  @observable activePanel: SettingPanel = 'props'
  @observable pageTitle: React.ReactNode = ''

  constructor() {
    makeObservable(this);
  }

  @action
  setActiveGroup = (group: string) => {
    this.activeGroup = group;
  }

  @action
  setPanelOpen = (open: boolean) => {
    this.panelOpen = open;
    if (!open) {
      this.setPanelPinned(false);
    }
  }

  @action
  setPanelPinned = (pin: boolean) => {
    this.panelPinned = pin;
  }

  checkPanel = () => {
    if (!this.panelPinned) {
      this.setPanelOpen(false);
    }
  }

  @action
  setActivePanel = (panel: SettingPanel): void => {
    this.activePanel = panel;
  }

  @action
  setPageTitle = (title: React.ReactNode): void => {
    this.pageTitle = title;
  }

  @action
  reset = () => {

  }
}

export default new DesignerStore();
