import { WalletInfo } from "./WalletProvidersList";
import { formatAddress } from "./utils";
import { useEffect, useState } from "react";
import { detectNetwork } from "./wallet/rpc";
import { NetworkDetailPanel } from "./NetworkDetailPanel";

export const ConnectedWalletDetail = ({
  selectedWallet,
}: {
  selectedWallet?: WalletInfo;
}) => {
  const [connectedChainId, setConnectedChainId] = useState<number>(-1);

  useEffect(() => {
    if (selectedWallet && connectedChainId === -1) {
      console.log("Detecting chain");
      detectNetwork(selectedWallet.provider.provider).then((chainId) => {
        console.log("Detected chain", chainId);
        setConnectedChainId(chainId);
      });
    }
  });

  return (
    <>
      <h2>{selectedWallet ? "" : "No "}Wallet Selected</h2>
      {selectedWallet && (
        <>
          <div>
            <div>
              <img
                src={selectedWallet!.provider.info.icon}
                alt={selectedWallet!.provider.info.name}
              />
              <div>{selectedWallet!.provider.info.name}</div>
              <div>({formatAddress(selectedWallet!.userAccount)})</div>
            </div>
          </div>
          <NetworkDetailPanel
            chainId={connectedChainId}
            setChainId={setConnectedChainId}
            provider={selectedWallet.provider.provider}
          />
        </>
      )}
    </>
  );
};
