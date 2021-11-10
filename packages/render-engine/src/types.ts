import { OpenAPIV3 } from 'openapi-types';
import { BehaviorSubject, Observable } from 'rxjs';

export type Serialized = 'Serialized';
export type Instantiated = 'Instantiated';

// the shape of RequestParams is too complex
export type RequestParams = Partial<{
  params: Record<string, any>;
  body: any;
}> | undefined;

export type RequestConfig = {
  path: string;
  method: OpenAPIV3.HttpMethods;
  query?: Record<string, string>;
  header?: Record<string, string>;
  body?: any;
}

export type APIState = {
  params: RequestParams;
  loading: boolean;
  data?: any;
  error?: Error;
};

export type LocalState = {
  data?: any;
}

export const enum ComponentPropType {
  ConstantProperty = 'constant_property',
  APIDerivedProperty = 'api_derived_property',
  LocalStateProperty = 'local_state_property',
  FunctionalProperty = 'functional_property',

  SetLocalStateProperty = 'set_local_state_property',
  APIInvokeProperty = 'api_invoke_property',
}

export type NodeProperty<T> =
  ConstantProperty |
  APIDerivedProperty<T> |
  LocalStateProperty<T> |
  FunctionalProperty<T> |
  SetLocalStateProperty<T> |
  APIInvokeProperty<T> |
  Array<APIInvokeProperty<T>>;

export type NodeProperties<T> = Record<string, NodeProperty<T>>;

type BaseComponentProperty = {
  type: ComponentPropType;
}

export type ConstantProperty = BaseComponentProperty & {
  type: ComponentPropType.ConstantProperty;
  value: any;
}

export type APIDerivedProperty<T> = BaseComponentProperty & {
  type: ComponentPropType.APIDerivedProperty;
  initialValue?: any;
  stateID: string;
  // todo define different type adapter
  adapter?: APIStateAdapter<T>;
}

export type LocalStateProperty<T> = BaseComponentProperty & {
  type: ComponentPropType.LocalStateProperty;
  // this is not a good design
  stateID: string;
  // todo define different type adapter
  adapter?: LocalStateConvertor<T>;
}

export type FunctionalProperty<T> = BaseComponentProperty & {
  type: ComponentPropType.FunctionalProperty;
  func: T extends Serialized ? BaseFunctionSpec : VersatileFunc;
}

// todo refactor this type property spec
export type SetLocalStateProperty<T> = {
  type: ComponentPropType.SetLocalStateProperty;
  stateID: string;
  callbacks?: Array<() => void>;
}

// todo refactor this type property spec
export type APIInvokeProperty<T> = {
  type: ComponentPropType.APIInvokeProperty;
  stateID: string;
  // the required return type is too complex
  paramsBuilder?: ParamsBuilder<T>;
  onSuccess?: APIInvokeCallBack<T>;
  onError?: APIInvokeCallBack<T>;
}

type BaseFunctionSpec = {
  type: string;
  args: string;
  body: string;
}

export type RawFunctionSpec = BaseFunctionSpec & {
  type: 'raw';
}

export type ParamsBuilderFuncSpec = BaseFunctionSpec & {
  type: 'param_builder_func_spec';
}

export type APIInvokeCallbackFuncSpec = BaseFunctionSpec & {
  type: 'api_invoke_call_func_spec';
  args: '{ data, error, loading, params }';
}

export type LocalStateConvertFuncSpec = BaseFunctionSpec & {
  type: 'local_state_convert_func_spec';
  // `data` is unacceptable!
  args: '{ data }';
}

export type RunParam = {
  params?: RequestParams;
  onSuccess?: APIInvokeCallBack<Instantiated>;
  onError?: APIInvokeCallBack<Instantiated>;
}

export interface APIStateContext {
  runAction: (stateID: string, runParam?: RunParam) => void;
  refresh: (stateID: string) => void;
  getState: (stateID: string) => Observable<APIState>;
  getAction: (stateID: string) => (runParam?: RunParam) => void;
}

export interface LocalStateContext {
  getState$: (stateID: string) => BehaviorSubject<any>;
}

export type CTX = {
  apiStateContext: APIStateContext;
  localStateContext: LocalStateContext;
}

export type APIStateConvertor = (apiState: APIState) => any;

export type APIStateTemplate = {
  type: 'api_state_template';
  // template for data, loading, params, error
  // {{ data.foo }}
  // {{ data.offset / (data.limit + data.offset) }}
  // {{ data.list.map((item) => item.name)) }}
  // {{ data.list.map((item) => `名称：${item.name}`)) }}
  // {{ data.foo?.bar?.baz || 'someValue' }}
  template: string;
}

export type LocalStateTemplate = {
  type: 'local_state_template';
  // template for data
  // {{ data.foo }}
  // {{ data.offset / (data.limit + data.offset) }}
  // {{ data.list.map((item) => item.name)) }}
  // {{ data.list.map((item) => `名称：${item.name}`)) }}
  // {{ data.foo?.bar?.baz || 'someValue' }}
  template: string;
}

// todo refactor this type property spec
export type APIStateConvertFuncSpec = BaseFunctionSpec & {
  type: 'api_state_convertor_func_spec';
  args: '{ data, error, loading, params }';
};

export type SerializedAPIStateAdapter = APIStateTemplate | APIStateConvertFuncSpec;
export type SerializedLocalStateAdapter = LocalStateTemplate | LocalStateConvertFuncSpec;

export type LocalStateConvertFunc = (data: any) => any;

export type APIStateAdapter<T> = T extends Serialized ? SerializedAPIStateAdapter : APIStateConvertor;
export type LocalStateConvertor<T> = T extends Serialized ? SerializedLocalStateAdapter : LocalStateConvertFunc;
export type ParamsBuilder<T> = T extends Serialized ? ParamsBuilderFuncSpec : (...args: any[]) => RequestParams;
export type APIInvokeCallBack<T> = T extends Serialized ? APIInvokeCallbackFuncSpec : (apiState: APIState) => void;

export type VersatileFunc = (...args: any) => any;

interface BaseNode<T> {
  key: string;
  type: 'html-element' | 'react-component';
  props?: NodeProperties<T>;
  children?: BaseNode<T>[];
}

interface HTMLNode<T> extends BaseNode<T> {
  type: 'html-element';
  name: string;
  children?: Array<SchemaNode<T>>;
}

interface ReactComponentNode<T> extends BaseNode<T> {
  type: 'react-component';
  packageName: string;
  packageVersion: string;
  exportName: 'default' | string;
  // not recommend, should avoid
  // subModule?: string;
  children?: Array<SchemaNode<T>>;
}

export type SchemaNode<T> = HTMLNode<T> | ReactComponentNode<T>;

// map of stateID and operationID
export type APIStateSpec = Record<string, {
  operationID: string;
  [key: string]: any;
}>;

export type LocalStateSpec = Record<string, { initial: any; }>;

export type Schema = {
  node: SchemaNode<Serialized>;
  apiStateSpec: APIStateSpec;
  localStateSpec: LocalStateSpec;
}

export type InstantiatedNode = SchemaNode<Instantiated>;

interface Document {
  adoptedStyleSheets: any[];
}

export type DynamicComponent = React.FC<any> | React.ComponentClass<any>;
