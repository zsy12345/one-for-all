import type { APIInvokeProperty, ResultDerivedProperty } from '../src/types';

import mockXHR from 'xhr-mock';
import { renderHook } from '@testing-library/react-hooks';

import petStoreSpec from '@ofa/spec-interpreter/test/petstore-spec';
import useStateDerivedProps from '../src/use-state-derived-props';
import useAPICallProps from '../src/use-api-call-props';
import StateHub from '../src/state-hub';

beforeEach(() => mockXHR.setup());
afterEach(() => mockXHR.teardown());

const streamIDMap = { stream_findPetsByTags: 'findPetsByTags' };
const stateHub = new StateHub(petStoreSpec, streamIDMap);

test('expect_resolve_initial_value', () => {
  const convertorFn = jest.fn();

  const props: Record<string, ResultDerivedProperty> = {
    foo: {
      type: 'result_derived_property',
      initialValue: { foo: 123 },
      streamID: 'stream_findPetsByTags',
      convertor: convertorFn,
    },
    bar: {
      type: 'result_derived_property',
      initialValue: { bar: 456 },
      streamID: 'stream_findPetsByTags',
      convertor: convertorFn,
    },
  };

  const { result } = renderHook(() => useStateDerivedProps({ stateHub, props }));
  expect(result.current).toMatchObject({ foo: { foo: 123 }, bar: { bar: 456 } });
  expect(convertorFn).not.toBeCalled();
});

test('expect_resolve_converted_value', (done) => {
  const mockRes = { data: { id: 'abc-123' } };
  mockXHR.get(/.*/, (req, res) => res.status(200).body(JSON.stringify(mockRes)));

  const apiCallProps: Record<string, APIInvokeProperty> = {
    update: {
      type: 'api_invoke_property',
      streamID: 'stream_findPetsByTags',
      convertor: () => {
        return { params: { foo: 'bar' } };
      },
    },
  };
  const apiCallPropsResult = useAPICallProps({ stateHub, props: apiCallProps });
  stateHub.getValue('stream_findPetsByTags').subscribe((result) => {
    expect(result.data).toMatchObject(mockRes);
    done();
  });

  apiCallPropsResult.update();
});
