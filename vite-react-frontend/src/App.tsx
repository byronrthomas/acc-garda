import { useEffect, useState } from "react";
import "./App.css";
import { WalletInfo, WalletProvidersList } from "./WalletProvidersList";
import { ConnectedWalletDetail } from "./ConnectedWalletDetail";
import { initChainReadRPC } from "./wallet/rpc";
import { SmartAccountDetail } from "./SmartAccountDetail";

function App() {
  const readOnlyRpcProv = initChainReadRPC();
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo>();
  const [searchParams, setSearchParams] = useState<URLSearchParams>();

  useEffect(() => {
    console.log("Got a location as", window.location.href);
    console.log("Got a search as", window.location.search);
    setSearchParams(new URLSearchParams(window.location.search));
  }, []);

  return (
    <>
      <h1>Smart account links</h1>

      <WalletProvidersList onWalletSelected={setSelectedWallet} />
      <hr />
      <ConnectedWalletDetail selectedWallet={selectedWallet} />
      {searchParams && (
        <SmartAccountDetail
          readOnlyRpcProv={readOnlyRpcProv}
          searchParams={searchParams}
          walletInfo={selectedWallet}
        ></SmartAccountDetail>
      )}
    </>
  );
}

export default App;
