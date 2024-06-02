import { useEffect, useState } from "react";
import { AccountContractDetails, fetchOwnerDetails } from "./wallet/rpc";
import Web3 from "web3";
import { WalletInfo } from "./WalletProvidersList";
import { OwnerChangeLinkPanel } from "./guardianLinks/OwnerChangeLinkPanel";
import OwnerTransactionPanel from "./ownerPanels/OwnerTransactionPanel";
import { SpendAllowanceLinkPanel } from "./guardianLinks/SpendAllowanceLinkPanel";
import { RiskLimitsPanel } from "./ownerPanels/RiskLimitsPanel";
import { VoteForNewOwnerPanel } from "./guardianVoting/VoteForNewOwnerPanel";
import { VoteForSpendApprovalPanel } from "./guardianVoting/VoteForSpendApprovalPanel";
import { VoteForNewRiskParamsPanel } from "./guardianVoting/VoteForNewRiskParamsPanel";
import { TimeDelayedSpendPanel } from "./ownerPanels/TimeDelayedSpendPanel";

export const SmartAccountDetail = ({
  readOnlyRpcProv,
  searchParams,
  walletInfo,
}: {
  readOnlyRpcProv: Web3;
  searchParams: URLSearchParams;
  walletInfo?: WalletInfo;
}) => {
  const [accountDetails, setAccountDetails] =
    useState<AccountContractDetails | null>(null);

  let contractAddress = searchParams && searchParams.get("contractAddress");
  contractAddress =
    contractAddress || import.meta.env.VITE_DEFAULT_CONTRACT_ADDRESS;

  useEffect(() => {
    if (!accountDetails && contractAddress) {
      fetchOwnerDetails(readOnlyRpcProv, contractAddress!).then((details) => {
        setAccountDetails(details);
      });
    }
  }, [readOnlyRpcProv, accountDetails, contractAddress]);

  const checkSameOwner = function (
    owner1: string | undefined,
    owner2: string | undefined
  ) {
    return owner1 && owner2 && owner1.toLowerCase() === owner2.toLowerCase();
  };

  const amCurrentOwner = checkSameOwner(
    walletInfo?.userAccount,
    accountDetails?.ownerAddress
  );

  const newOwnerAddress = searchParams && searchParams.get("newOwnerAddress");
  const allowanceAmount = searchParams && searchParams.get("allowanceAmount");
  const riskLimitSpecificLimit =
    searchParams && searchParams.get("riskLimitSpecificLimit");
  const riskLimitTimeWindow =
    searchParams && searchParams.get("riskLimitTimeWindow");
  const riskLimitDefaultLimit =
    searchParams && searchParams.get("riskLimitDefaultLimit");
  const tokenAddress = searchParams && searchParams.get("tokenAddress");
  let actionType = "non_voting_functions";
  if (newOwnerAddress) {
    actionType = "vote_owner";
  } else if (allowanceAmount) {
    actionType = "vote_spend_allowance";
  } else if (riskLimitSpecificLimit) {
    actionType = "vote_risk_limit_specific";
  } else if (riskLimitTimeWindow) {
    actionType = "vote_risk_limit_time_window";
  } else if (riskLimitDefaultLimit) {
    actionType = "vote_risk_limit_default";
  }

  return accountDetails === null ? (
    <div>Loading...</div>
  ) : (
    <>
      <div className="content-card">
        <div>
          <b>Connected to Smart Account</b>
        </div>
        <div>{contractAddress}</div>
        <hr />
        <div style={{ display: "flex", flexDirection: "row" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              textAlign: "left",
            }}
          >
            <div>
              <div>
                Owned by <b>{accountDetails.displayName}</b>
              </div>
              <div style={{ fontSize: "0.8em" }}>
                ({accountDetails.ownerAddress})
              </div>
            </div>
          </div>
        </div>
      </div>
      {actionType === "vote_owner" && (
        <VoteForNewOwnerPanel
          walletInfo={walletInfo}
          accountDetails={accountDetails}
          newOwnerAddress={newOwnerAddress!}
          readOnlyRpcProv={readOnlyRpcProv}
          contractAddress={contractAddress!}
        />
      )}
      {actionType === "vote_spend_allowance" && (
        <VoteForSpendApprovalPanel
          walletInfo={walletInfo}
          accountDetails={accountDetails}
          tokenAddress={tokenAddress!}
          newAllowanceAmount={allowanceAmount!}
          readOnlyRpcProv={readOnlyRpcProv}
          contractAddress={contractAddress!}
          isEther={accountDetails.etherTokenAddress === tokenAddress}
        />
      )}
      {actionType === "vote_risk_limit_specific" && (
        <VoteForNewRiskParamsPanel
          walletInfo={walletInfo}
          accountDetails={accountDetails}
          paramsChange={{
            changeType: "specificLimit",
            tokenAddress: tokenAddress,
            newValue: riskLimitSpecificLimit!,
            isEther: accountDetails.etherTokenAddress === tokenAddress,
          }}
          readOnlyRpcProv={readOnlyRpcProv}
          contractAddress={contractAddress!}
        />
      )}
      {actionType === "vote_risk_limit_time_window" && (
        <VoteForNewRiskParamsPanel
          walletInfo={walletInfo}
          accountDetails={accountDetails}
          paramsChange={{
            changeType: "timeWindow",
            newValue: riskLimitTimeWindow!,
          }}
          readOnlyRpcProv={readOnlyRpcProv}
          contractAddress={contractAddress!}
        />
      )}
      {actionType === "vote_risk_limit_default" && (
        <VoteForNewRiskParamsPanel
          walletInfo={walletInfo}
          accountDetails={accountDetails}
          paramsChange={{
            changeType: "defaultLimit",
            newValue: riskLimitDefaultLimit!,
          }}
          readOnlyRpcProv={readOnlyRpcProv}
          contractAddress={contractAddress!}
        />
      )}
      {actionType === "non_voting_functions" && (
        <>
          <div className="content-card">
            <h3>Recover account</h3>
            <OwnerChangeLinkPanel contractAddress={contractAddress!} />
          </div>
          <div className="content-card">
            <h3>Break-glass spend approval above risk limits</h3>
            <SpendAllowanceLinkPanel contractAddress={contractAddress!} />
          </div>
        </>
      )}
      {amCurrentOwner && (
        <>
          <OwnerTransactionPanel
            contractAddress={contractAddress!}
            walletInfo={walletInfo}
            readonlyRpcProv={readOnlyRpcProv}
          />
          <RiskLimitsPanel
            readOnlyRpcProv={readOnlyRpcProv}
            contractAddress={contractAddress!}
            walletInfo={walletInfo}
            accountDetails={accountDetails}
          />
          <TimeDelayedSpendPanel
            readOnlyRpcProv={readOnlyRpcProv}
            contractAddress={contractAddress!}
            walletInfo={walletInfo}
            accountDetails={accountDetails}
          />
        </>
      )}
    </>
  );
};
