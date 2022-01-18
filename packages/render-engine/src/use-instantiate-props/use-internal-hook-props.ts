import { useMemo } from 'react';

import { SchemaNode, CTX, VersatileFunc } from '../types';

type InternalHookProps = Record<string, VersatileFunc | undefined>;

// todo give this hook a better name
function useInternalHookProps(node: SchemaNode, ctx: CTX): InternalHookProps {
  return useMemo(() => {
    if ('supportStateExposure' in node && node.supportStateExposure) {
      return {
        __exposeState: (state: unknown): void => {
          ctx.statesHubShared.exposeNodeState(node.id, state);
        },
      };
    }

    return {};
  }, []);
}

export default useInternalHookProps;
