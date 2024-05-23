import { useEffect, useState } from "react";
import "./App.css";
import { WalletInfo, WalletProvidersList } from "./WalletProvidersList";
import { ConnectedWalletDetail } from "./ConnectedWalletDetail";
import { initChainReadRPC } from "./wallet/rpc";
import { SmartAccountDetail } from "./SmartAccountDetail";

function App() {
  const readOnlyRpcProv = initChainReadRPC();
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo>();

  useEffect(() => {
    console.log("Got a location as", window.location.href);
    console.log("Got a search as", window.location.search);
  }, []);

  return (
    <>
      <h1>Smart account links</h1>

      <WalletProvidersList onWalletSelected={setSelectedWallet} />
      <hr />
      <ConnectedWalletDetail selectedWallet={selectedWallet} />
      {selectedWallet && (
        <SmartAccountDetail
          readOnlyRpcProv={readOnlyRpcProv}
        ></SmartAccountDetail>
      )}
    </>
  );
}

export default App;
