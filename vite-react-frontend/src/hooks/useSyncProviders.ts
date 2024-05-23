// Credit: this was ripped direct from the MetaMask docs - https://docs.metamask.io/wallet/how-to/connect/
import { useSyncExternalStore } from "react";
import { store } from "./store";

export const useSyncProviders = () =>
  useSyncExternalStore(store.subscribe, store.value, store.value);
