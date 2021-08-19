import mockXHR, { delay } from 'xhr-mock';

import petStoreSpec from '@ofa/spec-interpreter/test/petstore-spec';

import StateHub from '../src/state-hub';
import { initialState } from '../src/response';

beforeEach(() => mockXHR.setup());
afterEach(() => mockXHR.teardown());

test('resolve_initial_value_when_no_next_called', (done) => {
  const mockRes = { data: { id: 'abc-123' } };
  mockXHR.get(/.*/, (req, res) => {
    return res.status(200).body(JSON.stringify(mockRes));
  });

  const stateHub = new StateHub(petStoreSpec, { stream_findPetsByTags: 'findPetsByTags' });
  const [state$] = stateHub.getStream('stream_findPetsByTags');

  state$.subscribe((result) => {
    expect(result).toMatchObject(initialState);
    done();
  });
});

test('call_next_times', async () => {
  const mockRes = { data: { id: 'abc-123' } };
  mockXHR.get(/.*/, delay((req, res) => {
    return res.status(200).body(JSON.stringify(mockRes));
  }, 100));

  const stateHub = new StateHub(petStoreSpec, { stream_findPetsByTags: 'findPetsByTags' });
  const [state$, { run }] = stateHub.getStream('stream_findPetsByTags');

  const mockFn = jest.fn();
  state$.subscribe(mockFn);

  await new Promise((r) => setTimeout(() => {
    r(true);
    run({ params: undefined });
  }, 500));

  await new Promise((r) => setTimeout(() => {
    r(true);
    run({ params: undefined });
  }, 500));

  await new Promise((r) => setTimeout(r, 500));

  expect(mockFn).toBeCalledTimes(5);
});

test('only_resolve_the_last_value', async () => {
  const mockRes = { data: { id: 'abc-123' } };
  mockXHR.get(/.*/, delay((req, res) => {
    return res.status(200).body(JSON.stringify(mockRes));
  }, 100));

  const stateHub = new StateHub(petStoreSpec, { stream_findPetsByTags: 'findPetsByTags' });
  const [state$, { run }] = stateHub.getStream('stream_findPetsByTags');

  const mockFn = jest.fn();
  state$.subscribe(mockFn);

  run();
  run();
  run();
  run();

  await new Promise((r) => setTimeout(r, 500));

  expect(mockFn).toBeCalledTimes(3);
});

test('should_resolve_value', (done) => {
  const mockRes = { data: { id: 'abc-123' } };
  mockXHR.get(/.*/, (req, res) => {
    return res.status(200).body(JSON.stringify(mockRes));
  });

  const stateHub = new StateHub(petStoreSpec, { stream_findPetsByTags: 'findPetsByTags' });
  const [state$, { run }] = stateHub.getStream('stream_findPetsByTags');

  state$.subscribe(({ error, data: body }) => {
    expect(error).toBeUndefined();
    expect(body).toMatchObject(mockRes);
    done();
  });

  run();
});

test('same_stateID_same_stream', () => {
  const stateHub = new StateHub(petStoreSpec, { stream_findPetsByTags: 'findPetsByTags' });
  const [state$1, sendRequest1] = stateHub.getStream('stream_findPetsByTags');
  const [state$2, sendRequest2] = stateHub.getStream('stream_findPetsByTags');

  expect(state$1).toEqual(state$2);
  expect(sendRequest1).toEqual(sendRequest2);
});

test('param_match_input', (done) => {
  mockXHR.get(/.*/, (req, res) => {
    return res.status(200);
  });

  const stateHub = new StateHub(petStoreSpec, { stream_findPetsByTags: 'findPetsByTags' });
  const [state$, { run }] = stateHub.getStream('stream_findPetsByTags');
  const requestParams = { foo: 'bar' };
  const requestBody = { baz: 'bzz' };

  state$.subscribe(({ params }) => {
    expect(params?.params).toMatchObject(requestParams);
    expect(params?.body).toMatchObject(requestBody);
  });

  run({
    params: { params: requestParams, body: requestBody },
    onSuccess: () => done(),
  });
});

test('on_success_should_be_called', (done) => {
  mockXHR.get(/.*/, (req, res) => {
    return res.status(200);
  });

  const stateHub = new StateHub(petStoreSpec, { stream_findPetsByTags: 'findPetsByTags' });
  const [state$, { run }] = stateHub.getStream('stream_findPetsByTags');
  const requestParams = { foo: 'bar' };
  const requestBody = { baz: 'bzz' };

  const onSuccessFn = jest.fn();

  state$.subscribe((state) => {
    expect(onSuccessFn).toBeCalledTimes(1);
    expect(onSuccessFn).toBeCalledWith(state);
    done();
  });

  run({
    params: { params: requestParams, body: requestBody },
    onSuccess: onSuccessFn,
  });
  run({
    params: { params: requestParams, body: requestBody },
    onSuccess: onSuccessFn,
  });
  run({
    params: { params: requestParams, body: requestBody },
    onSuccess: onSuccessFn,
  });
  run({
    params: { params: requestParams, body: requestBody },
    onSuccess: onSuccessFn,
  });
});

test('on_error_should_be_called', (done) => {
  mockXHR.get(/.*/, (req, res) => {
    return res.status(400);
  });

  const stateHub = new StateHub(petStoreSpec, { stream_findPetsByTags: 'findPetsByTags' });
  const [state$, { run }] = stateHub.getStream('stream_findPetsByTags');
  const requestParams = { foo: 'bar' };
  const requestBody = { baz: 'bzz' };

  const onErrorFn = jest.fn();

  state$.subscribe((state) => {
    expect(onErrorFn).toBeCalledTimes(1);
    expect(onErrorFn).toBeCalledWith(state);
    done();
  });

  run({
    params: { params: requestParams, body: requestBody },
    onError: onErrorFn,
  });
  run({
    params: { params: requestParams, body: requestBody },
    onError: onErrorFn,
  });
  run({
    params: { params: requestParams, body: requestBody },
    onError: onErrorFn,
  });
  run({
    params: { params: requestParams, body: requestBody },
    onError: onErrorFn,
  });
});