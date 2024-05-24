// Credit: initial version of this was ripped direct from the MetaMask docs - https://docs.metamask.io/wallet/how-to/connect/
import { useEffect, useState } from "react";
import { useSyncProviders } from "./hooks/useSyncProviders";

export type DWPProps = {
  onWalletSelected: (info: WalletInfo) => void;
};

export type WalletInfo = {
  userAccount: string;
  provider: EIP6963ProviderDetail;
};

export const WalletProvidersList = ({ onWalletSelected }: DWPProps) => {
  const providers = useSyncProviders();
  const initVal = providers.length > 0 ? providers[0] : undefined;
  const [selectedProvider, setSelectedProvider] = useState<
    EIP6963ProviderDetail | undefined
  >();
  useEffect(() => {
    setSelectedProvider(initVal);
  });

  // Connect to the selected provider using eth_requestAccounts.
  const handleConnect = async (providerWithInfo: EIP6963ProviderDetail) => {
    try {
      const accounts = await providerWithInfo.provider.request({
        method: "eth_requestAccounts",
      });
      console.log("accounts", accounts);

      onWalletSelected({
        // @ts-ignore
        userAccount: String(accounts?.[0]),
        provider: providerWithInfo,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = providers.find(
      (provider) => provider.info.uuid === event.target.value
    );
    setSelectedProvider(selected);
  };
  // Display detected providers as connect buttons.
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {providers.length > 0 ? (
          <>
            <label htmlFor="walletList">Choose a wallet:</label>
            <select
              name="walletList"
              id="walletList"
              onChange={handleSelectChange}
              value={selectedProvider?.info.uuid || ""}
              style={{ width: "40%" }}
            >
              {providers.length > 0 &&
                providers?.map((provider: EIP6963ProviderDetail) => (
                  <option key={provider.info.uuid} value={provider.info.uuid}>
                    {provider.info.name}
                  </option>
                ))}
            </select>
          </>
        ) : (
          <div>No wallet providers detected</div>
        )}

        <button
          className="btn-primary"
          onClick={() => handleConnect(selectedProvider!)}
          disabled={!selectedProvider}
        >
          {selectedProvider && (
            <img
              src={selectedProvider.info.icon}
              alt={selectedProvider.info.name}
              style={{ maxHeight: "1em" }}
            />
          )}
          Connect
        </button>
      </div>
    </>
  );
};
