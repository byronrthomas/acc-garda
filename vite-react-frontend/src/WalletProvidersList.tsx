// Credit: initial version of this was ripped direct from the MetaMask docs - https://docs.metamask.io/wallet/how-to/connect/
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

  // Display detected providers as connect buttons.
  return (
    <>
      <h2>Wallets Detected:</h2>
      <div>
        {providers.length > 0 ? (
          providers?.map((provider: EIP6963ProviderDetail) => (
            <button
              key={provider.info.uuid}
              onClick={() => handleConnect(provider)}
            >
              <img src={provider.info.icon} alt={provider.info.name} />
              <div>{provider.info.name}</div>
            </button>
          ))
        ) : (
          <div>No Announced Wallet Providers</div>
        )}
      </div>
    </>
  );
};
