import { createAsyncSelector } from '../createAsyncSelector'
import { AsyncValue, asyncValueReceived, asyncCommand, asyncAwaitingValue } from '../AsyncValue'
import { areSameReference } from '../Equality'
import { createTrackedSelector } from '../createTrackedSelector'
import { someHasChanged } from '../Tracked'
import { asyncSelectorResult } from '../AsyncSelectorResult'

describe('createAsyncSelector', () => {
  enum CommandType {
    DoSomething,
    DoSomethingElse
  }

  type Command = {
    type: CommandType
  }

  describe('two regular selectors', () => {
    type AppState = Readonly<{ version: number; num: number; str: string }>
    const numberSelector = (appState: AppState) => appState.num
    const stringSelector = (appState: AppState) => appState.str

    const initialAppState: AppState = { version: 1, num: 2, str: 'one' }

    describe('producing a regular value', () => {
      it('should correctly combine two regular selectors', () => {
        const res = createAsyncSelector(stringSelector, numberSelector, (s, n) => s.length + n)

        const toVerify = res(initialAppState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncValueReceived(5), [])
        expect(toVerify).toEqual(expected)
      })

      it('should run only once when called with the same arguments twice', () => {
        let numberOfTimesExecuted = 0
        const res = createAsyncSelector(stringSelector, numberSelector, (s, n) => {
          numberOfTimesExecuted += 1
          return s.length + n
        })

        // Call the selector twice, with the same arguments:
        res({ ...initialAppState, version: 1 })
        res({ ...initialAppState, version: 2 })

        expect(numberOfTimesExecuted).toEqual(1)
      })

      it('should run again when the arguments change', () => {
        let numberOfTimesExecuted = 0
        const res = createAsyncSelector(stringSelector, numberSelector, (s, n) => {
          numberOfTimesExecuted += 1
          return s.length + n
        })

        // Call the selector three times, with the different arguments:
        res({ version: 1, num: 1, str: 'one' })
        res({ version: 2, num: 1, str: 'uno' })
        res({ version: 3, num: 3, str: 'uno' })

        expect(numberOfTimesExecuted).toEqual(3)
      })
    })

    describe('producing a `AsyncValue`', () => {
      it('should correctly combine two regular selectors and return a `AsyncCommand` when the combinator returns that', () => {
        const res = createAsyncSelector(stringSelector, numberSelector, (_s, _n) => asyncCommand<Command>([{ type: CommandType.DoSomething }]))

        const toVerify = res(initialAppState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncCommand([{ type: CommandType.DoSomething }]), [])
        expect(toVerify).toEqual(expected)
      })

      it('should correctly combine two regular selectors and return a `AsyncAwaitingValue` when the combinator returns that', () => {
        const res = createAsyncSelector(stringSelector, numberSelector, (_s, _n) => asyncAwaitingValue())

        const toVerify = res(initialAppState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncAwaitingValue(), [])
        expect(toVerify).toEqual(expected)
      })

      it('should correctly combine two regular selectors and return a `AsyncValueReceived` when the combinator returns that', () => {
        const res = createAsyncSelector(stringSelector, numberSelector, (s, n) => asyncValueReceived(s.length + n))

        const toVerify = res(initialAppState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncValueReceived(5), [])
        expect(toVerify).toEqual(expected)
      })
    })
  })

  describe('two async selectors and a regular selector', () => {
    type AppState = Readonly<{ version: number; num: AsyncValue<Command, number>; str: AsyncValue<Command, string>; bool: boolean }>
    const asyncNumberSelector = (appState: AppState) => asyncSelectorResult<AppState, Command, number>(appState.num, [])
    const asyncStringSelector = (appState: AppState) => asyncSelectorResult<AppState, Command, string>(appState.str, [])
    const boolSelector = (appState: AppState) => appState.bool

    const initialAppState: AppState = { version: 1, num: asyncValueReceived(2), str: asyncValueReceived('one'), bool: false }

    describe('producing a regular value', () => {
      it('should return an `AsyncValueReceived` when all async selectors produce an `AsyncValueReceived`', () => {
        let wasCalled = false
        const res = createAsyncSelector(asyncStringSelector, asyncNumberSelector, boolSelector, (s, n, b) => {
          wasCalled = true
          return s.length + n * (b ? 2 : 1)
        })

        const toVerify = res(initialAppState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncValueReceived(5), [])
        expect(toVerify).toEqual(expected)
        expect(wasCalled).toEqual(true)
      })

      it('should return an `AsyncAwaitingValue` when one of the async selectors produces an `AsyncAwaitingValue` and the result produce an `AsyncValueReceived`', () => {
        let wasCalled = false
        const appState: AppState = { version: 1, num: asyncAwaitingValue(), str: asyncValueReceived('one'), bool: false }
        const res = createAsyncSelector(asyncStringSelector, asyncNumberSelector, boolSelector, (s, n, b) => {
          wasCalled = true
          return s.length + n * (b ? 2 : 1)
        })

        const toVerify = res(appState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncAwaitingValue(), [])
        expect(toVerify).toEqual(expected)
        expect(wasCalled).toEqual(false)
      })

      it('should return an `AsyncCommand` when one of the async selectors produces an `AsyncCommand`', () => {
        let wasCalled = false
        const appState: AppState = {
          version: 1,
          num: asyncAwaitingValue(),
          str: asyncCommand([{ type: CommandType.DoSomething }, { type: CommandType.DoSomethingElse }]),
          bool: false
        }
        const res = createAsyncSelector(asyncStringSelector, asyncNumberSelector, boolSelector, (s, n, b) => {
          wasCalled = true
          return s.length + n * (b ? 2 : 1)
        })

        const toVerify = res(appState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncCommand([{ type: CommandType.DoSomething }, { type: CommandType.DoSomethingElse }]), [])
        expect(toVerify).toEqual(expected)
        expect(wasCalled).toEqual(false)
      })

      it('should return an `AsyncCommand` with multiple commands if more of the async selectors produce an `AsyncCommand`', () => {
        let wasCalled = false
        const appState: AppState = {
          version: 1,
          num: asyncCommand([{ type: CommandType.DoSomethingElse }]),
          str: asyncCommand([{ type: CommandType.DoSomething }]),
          bool: false
        }
        const res = createAsyncSelector(asyncStringSelector, asyncNumberSelector, boolSelector, (s, n, b) => {
          wasCalled = true
          return s.length + n * (b ? 2 : 1)
        })

        const toVerify = res(appState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncCommand([{ type: CommandType.DoSomething }, { type: CommandType.DoSomethingElse }]), [])
        expect(toVerify).toEqual(expected)
        expect(wasCalled).toEqual(false)
      })

      it('should run only once when called with the same arguments twice', () => {
        let numberOfTimesExecuted = 0
        const res = createAsyncSelector(asyncStringSelector, asyncNumberSelector, boolSelector, (s, n, b) => {
          numberOfTimesExecuted += 1
          return s.length + n * (b ? 2 : 1)
        })

        // Call the selector twice, with the same arguments:
        res({ ...initialAppState, version: 1 })
        res({ ...initialAppState, version: 2 })

        expect(numberOfTimesExecuted).toEqual(1)
      })

      it('should run only once when called with different async values, which contain the same values', () => {
        let numberOfTimesExecuted = 0
        const res = createAsyncSelector(asyncStringSelector, asyncNumberSelector, boolSelector, (s, n, b) => {
          numberOfTimesExecuted += 1
          return s.length + n * (b ? 2 : 1)
        })

        // Call the selector twice, with different async values which contain the same values:
        res({ ...initialAppState, version: 1, str: asyncValueReceived('one') })
        res({ ...initialAppState, version: 2, str: asyncValueReceived('one') })

        expect(numberOfTimesExecuted).toEqual(1)
      })

      it('should run again when the arguments change', () => {
        let numberOfTimesExecuted = 0
        const res = createAsyncSelector(asyncStringSelector, asyncNumberSelector, boolSelector, (s, n, b) => {
          numberOfTimesExecuted += 1
          return s.length + n * (b ? 2 : 1)
        })

        // Call the selector three times, with the different arguments:
        res({ ...initialAppState, version: 1, str: asyncValueReceived('one'), num: asyncValueReceived(2) })
        res({ ...initialAppState, version: 1, str: asyncValueReceived('uno'), num: asyncValueReceived(2) })
        res({ ...initialAppState, version: 1, str: asyncValueReceived('uno'), num: asyncValueReceived(3) })

        expect(numberOfTimesExecuted).toEqual(3)
      })
    })

    describe('producing a `AsyncValue`', () => {
      it('should correctly combine two async selectors and a regular selector and return a `AsyncCommand` when the combinator returns that', () => {
        const res = createAsyncSelector(asyncStringSelector, asyncNumberSelector, boolSelector, (_s, _n, _b) => asyncCommand<Command>([{ type: CommandType.DoSomething }]))

        const toVerify = res(initialAppState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncCommand([{ type: CommandType.DoSomething }]), [])
        expect(toVerify).toEqual(expected)
      })

      it('should correctly combine two async selectors and a regular selector and return a `AsyncAwaitingValue` when the combinator returns that', () => {
        const res = createAsyncSelector(asyncStringSelector, asyncNumberSelector, boolSelector, (_s, _n, _b) => asyncAwaitingValue())

        const toVerify = res(initialAppState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncAwaitingValue(), [])
        expect(toVerify).toEqual(expected)
      })

      it('should correctly combine two async selectors and a regular selector and return a `AsyncValueReceived` when the combinator returns that', () => {
        const res = createAsyncSelector(asyncStringSelector, asyncNumberSelector, boolSelector, (s, n, b) => asyncValueReceived(s.length + n * (b ? 2 : 1)))

        const toVerify = res(initialAppState)
        const expected = asyncSelectorResult<AppState, Command, number>(asyncValueReceived(5), [])
        expect(toVerify).toEqual(expected)
      })
    })
  })

  describe('tracking inputs', () => {
    type AppState = Readonly<{ version: number; num: number; str: string }>
    const trackedNumberSelector = createTrackedSelector((appState: AppState) => appState.num, areSameReference)
    const trackedStringSelector = createTrackedSelector((appState: AppState) => appState.str, areSameReference)
    const res = createAsyncSelector(trackedStringSelector, trackedNumberSelector, (s, n) => s.length + n)

    const initialAppState: AppState = { version: 1, num: 2, str: 'one' }

    it('should be able to conclude that the inputs are the same', () => {
      const asyncSelectorResult = res({ ...initialAppState, version: 1 })
      const nextAppState: AppState = { ...initialAppState, version: 2 }
      expect(someHasChanged(asyncSelectorResult.trackedUserInput, nextAppState)).toEqual(false)
    })

    it('should be able to conclude that the inputs are different', () => {
      const asyncSelectorResult = res({ ...initialAppState, version: 1, num: 2 })
      const nextAppState: AppState = { ...initialAppState, version: 2, num: 3 }
      expect(someHasChanged(asyncSelectorResult.trackedUserInput, nextAppState)).toEqual(true)
    })
  })
})
