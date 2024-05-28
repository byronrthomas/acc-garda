import { useEffect, useState } from "react";
import { fetchOwnerDetails, voteToApproveTransfer } from "./wallet/rpc";
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
  const [ownerAddress, setOwnerAddress] = useState<string | null>(null);

  let contractAddress = searchParams && searchParams.get("contractAddress");
  contractAddress =
    contractAddress || import.meta.env.VITE_DEFAULT_CONTRACT_ADDRESS;

  const newOwnerAddress = searchParams && searchParams.get("newOwnerAddress");

  useEffect(() => {
    if (!displayName && contractAddress) {
      fetchOwnerDetails(readOnlyRpcProv, contractAddress!).then(
        ({ displayName, address }) => {
          setDisplayName(String(displayName));
          setOwnerAddress(String(address));
        }
      );
    }
  }, [readOnlyRpcProv, displayName, contractAddress]);

  const handleVoteSend = async () => {
    if (!walletInfo) {
      return;
    }
    const msg = `The account is in the process of being transferred to ${newOwnerAddress}. Only approve this if you are confident that ${displayName} has asked you to do this.`;
    if (!window.confirm(msg)) {
      return;
    }
    const gasPrice = await readOnlyRpcProv.eth.getGasPrice();
    await voteToApproveTransfer(
      walletInfo,
      contractAddress!,
      newOwnerAddress!,
      gasPrice
    );
  };

  const buttonDisabled = !(walletInfo && newOwnerAddress);

  const actionType = newOwnerAddress ? "vote" : "link";
  return displayName === null ? (
    <div>Loading...</div>
  ) : (
    <div className="content-card">
      {actionType === "vote" ? (
        <h3>Vote for new owner</h3>
      ) : (
        <h3>Recover account</h3>
      )}
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
              Owned by <b>{displayName}</b>
            </div>
            <div>{ownerAddress}</div>
          </div>
        </div>
      </div>
      <hr />

      {newOwnerAddress ? (
        <div>
          <button
            className={buttonDisabled ? "" : "btn-warn"}
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
