import Web3 from "web3";
import { WalletInfo } from "../WalletProvidersList";
import { AccountContractDetails, voteToApproveTransfer } from "../wallet/rpc";

export const VoteForNewOwnerPanel = ({
  walletInfo,
  accountDetails,
  newOwnerAddress,
  readOnlyRpcProv,
  contractAddress,
}: {
  walletInfo?: WalletInfo;
  accountDetails: AccountContractDetails;
  newOwnerAddress: string;
  readOnlyRpcProv: Web3;
  contractAddress?: string;
}) => {
  const buttonDisabled = !(walletInfo && newOwnerAddress);
  const handleVoteSend = async () => {
    if (!walletInfo) {
      return;
    }
    const msg = `The account is in the process of being transferred to ${newOwnerAddress}. Only approve this if you are confident that ${accountDetails.displayName} has asked you to do this.`;
    if (!window.confirm(msg)) {
      return;
    }
    await voteToApproveTransfer(
      walletInfo,
      contractAddress!,
      newOwnerAddress!,
      accountDetails.ownershipRegistryAddress
    );
  };
  return (
    <div className="content-card">
      <h3>Vote for new owner</h3>
      <hr />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          textAlign: "left",
        }}
      >
        <div>
          <b>Proposed new owner:</b>
        </div>
        <div>{newOwnerAddress}</div>
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
          ⚠️ Only approve this if you are confident that{" "}
          <b>{accountDetails.displayName}</b> has asked you to do this (e.g.
          they should have contacted you directly via a trustworthy channel) ⚠️
        </div>
        <button
          className={buttonDisabled ? "" : "btn-warn"}
          disabled={buttonDisabled}
          onClick={handleVoteSend}
          style={{ marginTop: "1em", fontSize: "1.2em" }}
        >
          Vote to approve transfer
        </button>
      </div>
    </div>
  );
};
