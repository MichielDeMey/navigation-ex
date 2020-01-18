import * as React from 'react';
import {
  getStateFromPath as getStateFromPathDefault,
  getPathFromState as getPathFromStateDefault,
  NavigationContainerRef,
} from '@react-navigation/core';

type GetStateFromPath = typeof getStateFromPathDefault;
type GetPathFromState = typeof getPathFromStateDefault;

type Config = Parameters<GetStateFromPath>[1];

type Options = {
  /**
   * The prefixes are stripped from the URL before parsing them.
   * Usually they are the `scheme` + `host` (e.g. `myapp://chat?user=jane`)
   */
  prefixes: string[];
  /**
   * Config to fine-tune how to parse the path.
   *
   * Example:
   * ```js
   * {
   *   Chat: {
   *     path: 'chat/:author/:id',
   *     parse: { id: Number }
   *   }
   * }
   * ```
   */
  config?: Config;
  /**
   * Custom function to parse the URL to a valid navigation state (advanced).
   */
  getStateFromPath?: GetStateFromPath;
  /**
   * Custom function to conver the state object to a valid URL (advanced).
   */
  getPathFromState?: GetPathFromState;
};

export default function useLinking(
  ref: React.RefObject<NavigationContainerRef>,
  {
    prefixes,
    config,
    getStateFromPath = getStateFromPathDefault,
    getPathFromState = getPathFromStateDefault,
  }: Options
) {
  // We store these options in ref to avoid re-creating getInitialState and re-subscribing listeners
  // This lets user avoid wrapping the items in `React.useCallback` or `React.useMemo`
  // Not re-creating `getInitialState` is important coz it makes it easier for the user to use in an effect
  const prefixesRef = React.useRef(prefixes);
  const configRef = React.useRef(config);
  const getStateFromPathRef = React.useRef(getStateFromPath);
  const getPathFromStateRef = React.useRef(getPathFromState);

  React.useEffect(() => {
    prefixesRef.current = prefixes;
    configRef.current = config;
    getStateFromPathRef.current = getStateFromPath;
    getPathFromStateRef.current = getPathFromState;
  }, [config, getPathFromState, getStateFromPath, prefixes]);

  const getInitialState = React.useCallback(() => {
    const path = location.pathname + location.search;

    if (path) {
      return getStateFromPathRef.current(path, configRef.current);
    } else {
      return undefined;
    }
  }, []);

  const isPopstateAction = React.useRef(false);
  const pathHistory = React.useRef<string[]>([]);

  React.useEffect(() => {
    window.addEventListener('popstate', () => {
      const path = location.pathname + location.search;

      isPopstateAction.current = true;

      if (pathHistory.current[pathHistory.current.length - 2] === path) {
        pathHistory.current.pop();
        ref.current?.goBack();
      } else {
        const state = history.state || getStateFromPathRef.current(path);

        ref.current?.resetRoot(state);
      }
    });
  }, [ref]);

  React.useEffect(() => {
    if (!pathHistory.current.length) {
      pathHistory.current.push(location.pathname + location.search);
    }

    const unsubscribe = ref.current?.addListener('state', e => {
      if (isPopstateAction.current) {
        isPopstateAction.current = false;
        return;
      }

      const state = ref.current?.getRootState();
      const path = getPathFromStateRef.current(state, configRef.current);

      if (pathHistory.current[pathHistory.current.length - 2] === path) {
        pathHistory.current.pop();
        history.replaceState(e.data.state, '', path);
        return;
      }

      if (path !== location.pathname + location.search) {
        pathHistory.current.push(path);
        history.pushState(e.data.state, '', path);
      } else {
        history.replaceState(e.data.state, '', path);
      }
    });

    return unsubscribe;
  });

  return {
    getInitialState,
  };
}
