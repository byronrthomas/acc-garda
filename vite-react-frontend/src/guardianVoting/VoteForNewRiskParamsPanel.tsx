import Web3 from "web3";
import { WalletInfo } from "../WalletProvidersList";
import {
  AccountContractDetails,
  voteForDefaultRiskLimitIncrease,
  voteForRiskLimitTimeWindowDecrease,
  voteForSpecificRiskLimitIncrease,
} from "../wallet/rpc";
import { ethers } from "ethers";

export type RiskParamsChange = {
  changeType: "defaultLimit" | "specificLimit" | "timeWindow";
  newValue: string;
  // tokenAddress is only needed for specificLimit changes
  tokenAddress?: string | null;
  isEther?: boolean;
};

function validChange(paramsChange: RiskParamsChange | undefined) {
  if (!paramsChange) {
    return false;
  }
  if (paramsChange.changeType === "specificLimit") {
    return !!paramsChange.tokenAddress;
  }
  return true;
}

export const VoteForNewRiskParamsPanel = ({
  walletInfo,
  accountDetails,
  paramsChange,
  readOnlyRpcProv,
  contractAddress,
}: {
  walletInfo?: WalletInfo;
  accountDetails: AccountContractDetails;
  paramsChange: RiskParamsChange;
  readOnlyRpcProv: Web3;
  contractAddress?: string;
}) => {
  const changeValid = validChange(paramsChange);
  const buttonDisabled = !(walletInfo && changeValid);
  const formattedValue = ethers.formatUnits(paramsChange.newValue, 18);
  let changeDescription = "";
  if (paramsChange.changeType === "defaultLimit") {
    changeDescription = `the default risk limit to ${formattedValue} ETH / Tokens`;
  } else if (paramsChange.changeType === "specificLimit") {
    if (paramsChange.isEther) {
      changeDescription = `the risk limit for ETHER to ${formattedValue} ETH`;
    } else {
      changeDescription = `the risk limit for UNKNOWN token at ${paramsChange.tokenAddress} to ${formattedValue}`;
    }
  } else if (paramsChange.changeType === "timeWindow") {
    changeDescription = `the risk time window to ${paramsChange.newValue} seconds`;
  }
  const { displayName } = accountDetails;
  const handleVoteSend = async () => {
    if (!walletInfo || !contractAddress || !changeValid) {
      return;
    }
    const msg = `${displayName} is asking for approval to make risk settings on the account less restrictive. They are proposing to set ${changeDescription}. Only approve this if you are confident that ${displayName} has asked you to do this.`;
    if (!window.confirm(msg)) {
      return;
    }
    if (paramsChange.changeType === "specificLimit") {
      await voteForSpecificRiskLimitIncrease(
        walletInfo,
        contractAddress,
        paramsChange.tokenAddress!,
        paramsChange.newValue,
        readOnlyRpcProv
      );
    } else if (paramsChange.changeType === "defaultLimit") {
      await voteForDefaultRiskLimitIncrease(
        walletInfo,
        contractAddress,
        paramsChange.newValue,
        readOnlyRpcProv
      );
    } else if (paramsChange.changeType === "timeWindow") {
      await voteForRiskLimitTimeWindowDecrease(
        walletInfo,
        contractAddress,
        paramsChange.newValue,
        readOnlyRpcProv
      );
    }
  };
  return (
    <div className="content-card">
      <h3>Approve less restrictive risk settings</h3>
      <hr />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
        }}
      >
        <div>
          <b>Risk setting change:</b>
        </div>
        <div>Set {changeDescription}</div>
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
          Vote to approve increased risk
        </button>
      </div>
    </div>
  );
};
