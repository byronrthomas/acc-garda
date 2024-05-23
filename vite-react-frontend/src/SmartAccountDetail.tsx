import { useEffect, useState } from "react";
import { fetchDisplayName, voteToApproveTransfer } from "./wallet/rpc";
import Web3 from "web3";
import { WalletInfo } from "./WalletProvidersList";
import { GuardianLinkPanel } from "./GuardianLinkPanel";

export const SmartAccountDetail = ({
  readOnlyRpcProv,
  searchParams,
  walletInfo,
}: {
  readOnlyRpcProv: Web3;
  searchParams: URLSearchParams;
  walletInfo?: WalletInfo;
}) => {
  const [displayName, setDisplayName] = useState<string | null>(null);

  let contractAddress = searchParams && searchParams.get("contractAddress");
  contractAddress =
    contractAddress || import.meta.env.VITE_DEFAULT_CONTRACT_ADDRESS;

  const newOwnerAddress = searchParams && searchParams.get("newOwnerAddress");

  useEffect(() => {
    fetchDisplayName(readOnlyRpcProv, contractAddress!).then((name) => {
      setDisplayName(String(name));
    });
  }, [readOnlyRpcProv]);

  const handleVoteSend = async () => {
    if (!walletInfo) {
      return;
    }
    voteToApproveTransfer(walletInfo, contractAddress!, newOwnerAddress!);
  };

  const buttonDisabled = !(walletInfo && newOwnerAddress);
  const buttonStyle = buttonDisabled ? {} : { backgroundColor: "red" };

  return displayName === null ? (
    <div>Loading...</div>
  ) : (
    <div>
      <div>
        You are interacting with the Smart Account deployed at {contractAddress}{" "}
        originally owned by {displayName}
      </div>
      {newOwnerAddress ? (
        <div>
          <div>
            The account is in the process of being transferred to{" "}
            {newOwnerAddress}. Only approve this if you are confident that{" "}
            <b>{displayName}</b> has asked you to do this.
          </div>
          <button
            style={buttonStyle}
            disabled={buttonDisabled}
            onClick={handleVoteSend}
          >
            Vote to approve transfer
          </button>
        </div>
      ) : (
        <div>
          <GuardianLinkPanel contractAddress={contractAddress!} />
        </div>
      )}
    </div>
  );
};
