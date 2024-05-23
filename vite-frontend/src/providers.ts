declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent;
  }
}

export type ConnectedState = {
  provider: EIP1193Provider;
  info: EIP6963ProviderInfo;
  chainId: number;
};

export type ConnectionState = {
  isConnected: boolean;
  connectedState?: ConnectedState;
  connectionError?: string;
};

// Connect to the selected provider using eth_requestAccounts and
// check the currently connected chain.
const connectWithProvider = async (
  wallet: EIP6963AnnounceProviderEvent["detail"],
  onStateUpdated: (newConnState: ConnectionState) => void
) => {
  try {
    await wallet.provider.request({ method: "eth_requestAccounts" });
    const connState: ConnectedState = {
      provider: wallet.provider,
      info: wallet.info,
      chainId: -1,
    };
    const updatedState: ConnectionState = {
      isConnected: true,
      connectedState: connState,
    };
    const chainId = await detectNetwork(wallet.provider);
    connState.chainId = chainId;
    onStateUpdated(updatedState);
  } catch (error: any) {
    console.error("Failed to connect to provider:", error);
    onStateUpdated({ isConnected: false, connectionError: error.message });
  }
};

// Display detected providers as connect buttons.
export function listProviders(
  element: HTMLDivElement,
  onSuccessfulConnect: (newConnState: ConnectionState) => void
) {
  window.addEventListener(
    "eip6963:announceProvider",
    (event: EIP6963AnnounceProviderEvent) => {
      const button = document.createElement("button");

      button.innerHTML = `
          <img src="${event.detail.info.icon}" alt="${event.detail.info.name}" />
          <div>Connect to ${event.detail.info.name}</div>
        `;

      // Call connectWithProvider when a user selects the button.
      button.onclick = () =>
        connectWithProvider(event.detail, onSuccessfulConnect);
      element.appendChild(button);
    }
  );

  // Notify event listeners and other parts of the dapp that a provider is requested.
  window.dispatchEvent(new Event("eip6963:requestProvider"));
}

export async function detectNetwork(provider: EIP1193Provider) {
  const chainId = await provider // Or window.ethereum if you don't support EIP-6963.
    .request({ method: "eth_chainId" });
  console.log("Currently on chain", chainId);
  // chainId should be a string that is either in hex or decimal format.
  // return it as an integer. If it is in hex it should start 0x, otherwise
  // it should be a decimal number.
  return parseChainId(chainId);
}

export function parseChainId(chainId: unknown) {
  return parseInt(String(chainId));
}

export function formatChainId(chainId: number) {
  return `0x${chainId.toString(16)}`;
}

export async function switchNetwork(
  initialState: ConnectionState,
  newChainId: string,
  onChainSwitched: (appState: ConnectionState) => void,
  onError: (msg: string) => void
) {
  try {
    const connectedState = initialState.connectedState!;
    await connectedState.provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: newChainId }],
    });
    onChainSwitched({
      isConnected: true,
      connectedState: {
        ...connectedState,
        chainId: parseChainId(newChainId),
      },
    });
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      onError(
        "Network doesn't exist. Please add the network details for it to your wallet provider (e.g. MetaMask)"
      );
    } else {
      onError(switchError.message);
    }
  }
}

console.log("Got a location as", window.location.href);
console.log("Got a search as", window.location.search);
