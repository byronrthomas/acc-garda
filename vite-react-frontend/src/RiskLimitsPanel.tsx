import Web3 from "web3";
import { WalletInfo } from "./WalletProvidersList";
import { useEffect, useState } from "react";
import { fetchRiskLimitDetails } from "./wallet/rpc";
import { ethers } from "ethers";

function voteTimeWindowLink(
  currentUrl: string,
  newTimeWindow: number | null,
  oldTimeWindow: number | null,
  contractAddress: string | null
) {
  if (!contractAddress || !newTimeWindow || !oldTimeWindow) {
    return "";
  }
  if (newTimeWindow > oldTimeWindow) {
    return "";
  }
  const url = new URL(currentUrl);
  url.searchParams.delete("contractAddress");
  url.searchParams.set("contractAddress", contractAddress);
  url.searchParams.set("riskLimitTimeWindow", String(newTimeWindow));
  return url.href;
}

function voteDefaultLimitLink(
  currentUrl: string,
  newDefaultLimit: number | null,
  oldDefaultLimit: number | null,
  contractAddress: string | null
) {
  if (!contractAddress || !newDefaultLimit || !oldDefaultLimit) {
    return "";
  }
  if (newDefaultLimit < oldDefaultLimit) {
    return "";
  }
  const url = new URL(currentUrl);
  url.searchParams.delete("contractAddress");
  url.searchParams.set("contractAddress", contractAddress);
  url.searchParams.set(
    "riskLimitDefaultLimit",
    ethers.parseEther(newDefaultLimit.toString()).toString()
  );
  return url.href;
}

export const RiskLimitsPanel = ({
  readOnlyRpcProv,
  contractAddress,
  walletInfo,
}: {
  readOnlyRpcProv: Web3;
  walletInfo?: WalletInfo;
  contractAddress: string;
}) => {
  const [initialDefaultLimit, setInitialDefaultLimit] = useState<string | null>(
    null
  );
  const [initialTimeWindow, setInitialTimeWindow] = useState<string | null>(
    null
  );
  const [numVotes, setNumVotes] = useState<string | null>(null);
  const [newTimeWindow, setNewTimeWindow] = useState<number | null>(null);
  const [newDefaultLimit, setNewDefaultLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!initialDefaultLimit && contractAddress) {
      fetchRiskLimitDetails(readOnlyRpcProv, contractAddress!).then(
        ({ defaultLimit, timeWindow, numVotes }) => {
          setInitialDefaultLimit(String(defaultLimit));
          setInitialTimeWindow(String(timeWindow));
          setNumVotes(String(numVotes));
        }
      );
    }
  }, [readOnlyRpcProv, initialDefaultLimit, contractAddress]);

  const votesRequired = Number(numVotes ?? 0) > 0;

  const timeWindowVoteLink = voteTimeWindowLink(
    window.location.href,
    newTimeWindow,
    initialTimeWindow ? Number(initialTimeWindow) : null,
    contractAddress
  );
  const defaultLimitVoteLink = voteDefaultLimitLink(
    window.location.href,
    newDefaultLimit,
    initialDefaultLimit
      ? Number(ethers.formatUnits(initialDefaultLimit, 18))
      : null,
    contractAddress
  );
  return (
    <div className="content-card">
      <h3>General Risk Limits</h3>
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
        <div>Risk limits time window:</div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignContent: "flex-start",
            textAlign: "left",
          }}
        >
          <label>Current</label>
          <input
            type="text"
            value={`${initialTimeWindow || 0} seconds`}
            disabled={true}
          />
          <label htmlFor="newTimeWindowInput">Update?</label>
          <input
            type="number"
            placeholder="New time window"
            value={newTimeWindow!}
            id="newTimeWindowInput"
            name="newTimeWindowInput"
            step="1"
            onChange={(e) => setNewTimeWindow(Number(e.target.value))}
          />
        </div>
        <div>
          Guardians can vote for this change at:
          <div className="link-block">
            {votesRequired && timeWindowVoteLink
              ? timeWindowVoteLink
              : "<Guardians do not need to vote for this change>"}
          </div>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <button
              className={"btn-primary"}
              disabled={votesRequired && timeWindowVoteLink !== ""}
              onClick={() => {
                alert("you clicked me");
              }}
            >
              {votesRequired && timeWindowVoteLink !== ""
                ? "Change by guardian voting (risk increase)"
                : "Submit change"}
            </button>
          </div>
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
          marginTop: "1em",
        }}
      >
        <div>Default spend limit:</div>
        <div
          style={{
            display: "flex",
            flexDirection: "row",
            justifyContent: "space-between",
            alignContent: "flex-start",
            textAlign: "left",
          }}
        >
          <label>Current</label>
          <input
            type="number"
            value={ethers.formatUnits(initialDefaultLimit || "0", 18)}
            disabled={true}
          />
          <label htmlFor="newDefaultLimitInput">Update?</label>
          <input
            type="number"
            placeholder="New limit e.g. 0.01"
            value={newDefaultLimit!}
            id="newDefaultLimitInput"
            name="newDefaultLimitInput"
            onChange={(e) => setNewDefaultLimit(Number(e.target.value))}
          />
        </div>
        <div>
          Guardians can vote for this change at:
          <div className="link-block">
            {votesRequired && defaultLimitVoteLink
              ? defaultLimitVoteLink
              : "<Guardians do not need to vote for this change>"}
          </div>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <button
              className={"btn-primary"}
              disabled={votesRequired && defaultLimitVoteLink !== ""}
              onClick={() => {
                alert("you clicked me");
              }}
            >
              {votesRequired && defaultLimitVoteLink !== ""
                ? "Change by guardian voting (risk increase)"
                : "Submit change"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
