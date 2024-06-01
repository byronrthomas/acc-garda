import Web3 from "web3";
import { WalletInfo } from "../WalletProvidersList";
import {
  AccountContractDetails,
  voteToApproveSpendAllowance,
} from "../wallet/rpc";
import { ethers } from "ethers";

export const VoteForSpendApprovalPanel = ({
  walletInfo,
  accountDetails,
  tokenAddress,
  newAllowanceAmount,
  readOnlyRpcProv,
  contractAddress,
  isEther,
}: {
  walletInfo?: WalletInfo;
  accountDetails: AccountContractDetails;
  tokenAddress: string;
  newAllowanceAmount: string;
  readOnlyRpcProv: Web3;
  contractAddress?: string;
  isEther: boolean;
}) => {
  const newAmountEth = ethers.formatEther(newAllowanceAmount);
  const buttonDisabled = !(walletInfo && tokenAddress && newAllowanceAmount);
  const tokenSymbol = isEther ? "ETH" : "UNKNOWN tokens";
  const tokenPostfix = isEther ? "" : ` (token at ${tokenAddress})`;
  const { displayName } = accountDetails;
  const handleVoteSend = async () => {
    if (!walletInfo) {
      return;
    }
    const msg = `${displayName} has requested emergency approval to spend above their risk limits. They would like to spend ${newAmountEth} ${tokenSymbol}${tokenPostfix}. Only approve this if you are confident that ${displayName} has asked you to do this.`;
    if (!window.confirm(msg)) {
      return;
    }
    await voteToApproveSpendAllowance(
      walletInfo,
      contractAddress!,
      tokenAddress!,
      newAllowanceAmount,
      readOnlyRpcProv
    );
  };
  return (
    <div className="content-card">
      <h3>Approve high-value spending</h3>
      <hr />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
        }}
      >
        <div>
          <b>Spend up to:</b>
        </div>
        <div>
          {newAmountEth} {tokenSymbol}
        </div>
        {!isEther && <div>Token address: {tokenAddress}</div>}
      </div>
      <hr />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
        }}
      >
        <div>
          ⚠️ Only approve this if you are confident that <b>{displayName}</b>{" "}
          has asked you to do this (e.g. they should have contacted you directly
          via a trustworthy channel) ⚠️
        </div>
        <button
          className={buttonDisabled ? "" : "btn-warn"}
          disabled={buttonDisabled}
          onClick={handleVoteSend}
          style={{ marginTop: "1em", fontSize: "1.2em" }}
        >
          Vote to approve high-value spend
        </button>
      </div>
    </div>
  );
};
