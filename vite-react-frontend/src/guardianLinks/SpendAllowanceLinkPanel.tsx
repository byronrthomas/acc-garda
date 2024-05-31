import { useState } from "react";
import { ethers } from "ethers";
import { urlWithoutSearchParams } from "../utils/links";

function makeLink(
  windowLocation: string,
  tokenAddress: string,
  amount: number | undefined,
  contractAddress: string
) {
  if (!windowLocation || !tokenAddress || !amount) {
    return "";
  }
  const url = urlWithoutSearchParams(windowLocation);
  url.searchParams.append("tokenAddress", tokenAddress);
  url.searchParams.append(
    "allowanceAmount",
    ethers.parseEther(amount.toString()).toString()
  );
  url.searchParams.append("contractAddress", contractAddress);
  return url.toString();
}

export const SpendAllowanceLinkPanel = ({
  contractAddress,
}: {
  contractAddress: string;
}) => {
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [amount, setAmount] = useState<number>();
  const handleAddrChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenAddress(e.target.value);
  };
  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setAmount(Number(e.target.value));
  };
  return (
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
        <label htmlFor="tokenAddrInput">Token being spent</label>
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

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignContent: "flex-start",
          textAlign: "left",
        }}
      >
        Guardians can vote for this change at:
        <div className="link-block">
          {makeLink(
            window.location.href,
            tokenAddress,
            amount,
            contractAddress
          )}
        </div>
      </div>
    </div>
  );
};
