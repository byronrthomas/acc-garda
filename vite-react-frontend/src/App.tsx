import { useEffect, useState } from "react";
import "./App.css";
import { WalletInfo } from "./WalletProvidersList";
import { initChainReadRPC } from "./wallet/rpc";
import { SmartAccountDetail } from "./SmartAccountDetail";
import { WalletProviderPanel } from "./WalletProviderPanel";
import { urlForContract } from "./utils/links";
const DEFAULT_CONTRACT = import.meta.env.VITE_DEFAULT_CONTRACT_ADDRESS;

function App() {
  const readOnlyRpcProv = initChainReadRPC();
  const [selectedWallet, setSelectedWallet] = useState<WalletInfo>();
  const [searchParams, setSearchParams] = useState<URLSearchParams>();

  useEffect(() => {
    // console.log("Got a location as", window.location.href);
    // console.log("Got a search as", window.location.search);
    // console.log("CONTRACT", DEFAULT_CONTRACT);
    const searchParams = new URLSearchParams(window.location.search);
    if (!searchParams.get("contractAddress") && DEFAULT_CONTRACT) {
      console.log("No contract address found in URL");
      window.location.href = urlForContract(DEFAULT_CONTRACT);
    } else {
      setSearchParams(searchParams);
    }
  }, []);

  return (
    <>
      <div className="title-card">
        <img
          alt="AccGarda"
          src="/logo_full_colour.png"
          style={{ width: "7em" }}
        ></img>
        <h1 style={{ marginTop: "0.5em" }}>Smart Account</h1>
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
