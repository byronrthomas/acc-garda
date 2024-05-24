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
      {selectedWallet ? (
        <>
          <div style={{ display: "flex", justifyContent: "space-evenly" }}>
            <img
              src={selectedWallet!.provider.info.icon}
              alt={selectedWallet!.provider.info.name}
              style={{ height: "2em" }}
            />
            <div>{selectedWallet!.provider.info.name}</div>
            <div>({formatAddress(selectedWallet!.userAccount)})</div>
          </div>
          <hr />
          <NetworkDetailPanel
            chainId={connectedChainId}
            setChainId={setConnectedChainId}
            provider={selectedWallet.provider.provider}
          />
        </>
      ) : (
        <h2>No wallet connected</h2>
      )}
    </>
  );
};
