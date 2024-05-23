declare global {
  interface WindowEventMap {
    "eip6963:announceProvider": CustomEvent;
  }
}

export type ConnectionState = {
  isConnected: boolean;
  connectedState?: {
    provider: EIP1193Provider;
    info: EIP6963ProviderInfo;
  };
  connectionError?: string;
};

// Connect to the selected provider using eth_requestAccounts.
const connectWithProvider = async (
  wallet: EIP6963AnnounceProviderEvent["detail"],
  onStateUpdated: (newConnState: ConnectionState) => void
) => {
  try {
    await wallet.provider.request({ method: "eth_requestAccounts" });
    onStateUpdated({ isConnected: true, connectedState: wallet });
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

console.log("Got a location as", window.location.href);
console.log("Got a search as", window.location.search);
