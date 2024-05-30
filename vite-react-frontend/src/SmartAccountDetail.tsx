import { useEffect, useState } from "react";
import { fetchOwnerDetails, voteToApproveTransfer } from "./wallet/rpc";
import Web3 from "web3";
import { WalletInfo } from "./WalletProvidersList";
import { OwnerChangeLinkPanel } from "./guardianLinks/OwnerChangeLinkPanel";
import OwnerTransactionPanel from "./OwnerTransactionPanel";

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

  const checkSameOwner = function (
    owner1: string | undefined,
    owner2: string | null
  ) {
    return owner1 && owner2 && owner1.toLowerCase() === owner2.toLowerCase();
  };

  const buttonDisabled = !(walletInfo && newOwnerAddress);
  const amCurrentOwner = checkSameOwner(walletInfo?.userAccount, ownerAddress);

  const actionType = newOwnerAddress ? "vote" : "link";
  return displayName === null ? (
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
                Owned by <b>{displayName}</b>
              </div>
              <div style={{ fontSize: "0.8em" }}>({ownerAddress})</div>
            </div>
          </div>
        </div>
      </div>
      <div className="content-card">
        {actionType === "vote" ? (
          <>
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
                <b>{displayName}</b> has asked you to do this (e.g. they should
                have contacted you directly via a secure channel) ⚠️
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
          </>
        ) : (
          <>
            <h3>Recover account</h3>
            <OwnerChangeLinkPanel contractAddress={contractAddress!} />
          </>
        )}
      </div>
      {amCurrentOwner && (
        <div className="content-card">
          <h3>Transact using Smart Account</h3>
          <OwnerTransactionPanel
            contractAddress={contractAddress!}
            walletInfo={walletInfo}
          />
        </div>
      )}
    </>
  );
};
