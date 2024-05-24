import { WalletInfo, WalletProvidersList } from "./WalletProvidersList";
import { ConnectedWalletDetail } from "./ConnectedWalletDetail";

export type WalletProviderPanelProps = {
  onWalletSelected: (info: WalletInfo) => void;
  selectedWallet?: WalletInfo;
};

export const WalletProviderPanel = (props: WalletProviderPanelProps) => {
  return (
    <div className="content-card">
      <WalletProvidersList onWalletSelected={props.onWalletSelected} />
      <hr />
      <ConnectedWalletDetail selectedWallet={props.selectedWallet} />
    </div>
  );
};
