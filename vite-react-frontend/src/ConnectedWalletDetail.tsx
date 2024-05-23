import { WalletInfo } from "./WalletProvidersList";
import { formatAddress } from "./utils";
import { useEffect, useState } from "react";

export const ConnectedWalletDetail = ({
  selectedWallet,
}: {
  selectedWallet?: WalletInfo;
}) => {
  const [connectedChainId, setConnectedChainId] = useState<number>(-1);

  useEffect(() => {
    if (selectedWallet && connectedChainId === -1) {
      alert("Need to select a chain");
    }
  });

  return (
    <>
      <h2>{selectedWallet ? "" : "No "}Wallet Selected</h2>
      {selectedWallet && (
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
      )}
    </>
  );
};
