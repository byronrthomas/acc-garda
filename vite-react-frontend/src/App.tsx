import { useEffect, useState } from "react";
import "./App.css";
import { WalletInfo } from "./WalletProvidersList";
import { initChainReadRPC } from "./wallet/rpc";
import { SmartAccountDetail } from "./SmartAccountDetail";
import { WalletProviderPanel } from "./WalletProviderPanel";

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
      <div className="title-card">
        <h1>appGarda Smart Account</h1>
      </div>

      <WalletProviderPanel
        onWalletSelected={setSelectedWallet}
        selectedWallet={selectedWallet}
      />
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
