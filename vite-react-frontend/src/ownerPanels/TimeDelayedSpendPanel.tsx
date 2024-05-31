import { useEffect, useState } from "react";
import {
  allowTimeDelayedTransaction,
  fetchRiskLimitDetails,
} from "../wallet/rpc";
import Web3 from "web3";
import { WalletInfo } from "../WalletProvidersList";
import { encodeTokenAmount } from "./RiskLimitsPanel";

function formatSecondsAsLocaleDate(seconds: number) {
  return new Date(seconds * 1000).toLocaleString();
}

export const TimeDelayedSpendPanel = ({
  contractAddress,
  readOnlyRpcProv,
  walletInfo,
}: {
  contractAddress: string;
  readOnlyRpcProv: Web3;
  walletInfo?: WalletInfo;
}) => {
  const [riskTimeWindow, setRiskTimeWindow] = useState<string | null>(null);
  const [etherAddress, setEtherAddress] = useState<string | null>(null);
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [amount, setAmount] = useState<number>();
  const handleAddrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenAddress(e.target.value);
  };
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(e.target.value));
  };

  useEffect(() => {
    if (!riskTimeWindow && contractAddress) {
      fetchRiskLimitDetails(readOnlyRpcProv, contractAddress!).then(
        ({ timeWindow, etherTokenAddress }) => {
          setRiskTimeWindow(String(timeWindow));
          setEtherAddress(String(etherTokenAddress));
        }
      );
    }
  }, [readOnlyRpcProv, riskTimeWindow, contractAddress]);

  const handleAllowanceRequest = async () => {
    if (!amount || !tokenAddress || !contractAddress) {
      return;
    }
    const secondsNow = Math.floor(Date.now() / 1000);
    const riskTimeWindowSeconds = Number(riskTimeWindow);
    // Add 10 seconds to ensure the delayUntil is after the risk time window
    const delayUntil = secondsNow + riskTimeWindowSeconds + 10;
    const formattedAmount = encodeTokenAmount(amount);
    console.log(
      `Requesting allowance of ${formattedAmount} at ${tokenAddress} to be spendable after ${delayUntil}`
    );
    const rsp = await allowTimeDelayedTransaction(
      contractAddress,
      tokenAddress,
      formattedAmount,
      delayUntil,
      walletInfo!
    );
    if (rsp) {
      alert(
        `Allowance request submitted successfully - you should be able to spend this amount after ${formatSecondsAsLocaleDate(
          delayUntil
        )}`
      );
    }
  };
  return (
    <div className="content-card">
      <h3>High-value spending (time-delayed)</h3>
      <hr />
      <div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            alignContent: "flex-start",
            textAlign: "left",
          }}
        >
          <label htmlFor="tokenAddrInput">Token to spend</label>
          <div style={{ fontSize: "0.8em" }}>
            ETH address: <em>{etherAddress}</em>
          </div>
          <input
            type="text"
            placeholder="Token address (e.g. 0xee75...)"
            onChange={handleAddrChange}
            value={tokenAddress}
            id="tokenAddrInput"
            name="tokenAddrInput"
          />
          <label htmlFor="amountInput">
            Allowance requested (in token units)
          </label>
          <div>
            <input
              type="number"
              placeholder="Amount e.g. 0.01"
              onChange={handleAmountChange}
              value={amount}
              id="tokenAddrInput"
              name="tokenAddrInput"
            />
            <span>
              <b>* 10*18</b> (assumes 18 decimals)
            </span>
          </div>
        </div>
        <hr />
        <div>
          <div>
            <b>IMPORTANT:</b> you will not be able to spend this allowance until
            after {riskTimeWindow} seconds of submitting this request
            (high-value transactions must be time-delayed for the risk time
            window, unless pre-approved by guardians)
          </div>
          <button
            className={"btn-primary"}
            disabled={!amount || !tokenAddress || !contractAddress}
            onClick={handleAllowanceRequest}
          >
            Request time-delayed high-value spend
          </button>
        </div>
        <hr />
      </div>
    </div>
  );
};
