import { useEffect, useState } from "react";
import "./App.css";
import { WalletInfo, WalletProvidersList } from "./WalletProvidersList";
import { ConnectedWalletDetail } from "./ConnectedWalletDetail";

function App() {
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
    </>
  );
}

export default App;
