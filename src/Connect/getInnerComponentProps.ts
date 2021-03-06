import { AsyncSelectorResults } from '../Select/AsyncSelectorResult'
import { NonePartial, none } from '../None'
import { keys } from '../utils'
import { ASYNC_VALUE_RECEIVED } from '../const'

export function getInnerComponentProps<AppState, OwnProps, Command, AsyncStateProps, SyncStateProps, DispatchProps>(
  asyncStatePropsOuter: AsyncSelectorResults<AppState, OwnProps, Command, AsyncStateProps>,
  syncStatePropsOuter: SyncStateProps,
  dispatchPropsOuter: DispatchProps
): NonePartial<AsyncStateProps> & SyncStateProps & DispatchProps {
  const asyncStatePropsAcc: Partial<NonePartial<AsyncStateProps>> = {}
  keys(asyncStatePropsOuter).forEach(key => {
    const { asyncValue } = asyncStatePropsOuter[key]
    asyncStatePropsAcc[key] = asyncValue.type === ASYNC_VALUE_RECEIVED ? asyncValue.value : none
  })
  const asyncStateProps = asyncStatePropsAcc as NonePartial<AsyncStateProps>

  return { ...asyncStateProps, ...syncStatePropsOuter, ...dispatchPropsOuter }
}
