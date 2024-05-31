import { useEffect, useState } from "react";
import { WalletInfo } from "../WalletProvidersList";
import { sendSmartAccountTx } from "../wallet/rpc";
import Web3 from "web3";
import { ethers } from "ethers";

export type OwnerTransactionPanelProps = {
  contractAddress: string;
  walletInfo?: WalletInfo;
  readonlyRpcProv: Web3;
};

export default function OwnerTransactionPanel(
  props: OwnerTransactionPanelProps
) {
  const [txDetails, setTxDetails] = useState({ to: "", value: "", data: "" });
  const [initialBalance, setInitialBalance] = useState<number | null>(null);
  useEffect(() => {
    if (!initialBalance && props.contractAddress && props.walletInfo) {
      props.readonlyRpcProv.eth
        .getBalance(props.contractAddress)
        .then((balance) => {
          console.log("Balance is", balance);
          setInitialBalance(Number(balance));
        });
    }
  });
  return (
    <div className="content-card">
      <h3>Transact using Smart Account</h3>
      <h4>
        Current balance:{" "}
        {ethers.formatEther(BigInt(initialBalance || 0)).substring(0, 7)} ETH
      </h4>
      <div className="vertical-form">
        <label htmlFor="toAddress">To</label>
        <input
          type="text"
          placeholder="To (address), e.g. 0xee75..."
          id="toAddress"
          name="toAddress"
          onChange={(e) => setTxDetails({ ...txDetails, to: e.target.value })}
        />
        <label htmlFor="txValue">Transaction value</label>
        <input
          type="text"
          placeholder="Transaction value in ETH (optional) e.g. 0.001"
          id="txValue"
          name="txValue"
          onChange={(e) =>
            setTxDetails({ ...txDetails, value: e.target.value })
          }
        />
        <label htmlFor="txData">Data</label>
        <input
          type="text"
          placeholder="Data (optional) e.g. 0x0100aa..."
          id="txData"
          name="txData"
          onChange={(e) => setTxDetails({ ...txDetails, data: e.target.value })}
        />
        <button
          className="btn-warn"
          onClick={() => {
            sendSmartAccountTx(
              txDetails,
              props.contractAddress,
              props.walletInfo!
            );
          }}
        >
          Send transaction
        </button>
      </div>
    </div>
  );
}
