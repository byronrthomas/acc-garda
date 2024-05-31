import Web3 from "web3";
import { WalletInfo } from "../WalletProvidersList";
import { useEffect, useState } from "react";
import {
  fetchRiskLimitDetails,
  fetchSpecificRiskLimit,
  setDefaultRiskLimit,
  setRiskLimitTimeWindow,
  setSpecificRiskLimit,
} from "../wallet/rpc";
import { ethers } from "ethers";
import { urlWithoutSearchParams } from "../utils/links";

function encodeTokenAmount(asEthLike: number): string {
  return ethers.parseEther(asEthLike.toString()).toString();
}

function voteTimeWindowLink(
  currentUrl: string,
  newTimeWindow: number | null,
  oldTimeWindow: number | null,
  contractAddress: string | null
) {
  if (!contractAddress || newTimeWindow === null || !oldTimeWindow) {
    return "";
  }
  if (newTimeWindow > oldTimeWindow) {
    return "";
  }
  const url = urlWithoutSearchParams(currentUrl);
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
  const url = urlWithoutSearchParams(currentUrl);
  url.searchParams.set("contractAddress", contractAddress);
  url.searchParams.set(
    "riskLimitDefaultLimit",
    encodeTokenAmount(newDefaultLimit)
  );
  return url.href;
}

function voteSpecificLimitLink(
  currentUrl: string,
  newSpecificLimit: number | null,
  oldSpecificLimit: number | null,
  contractAddress: string | null,
  tokenAddress: string | null
) {
  if (!contractAddress || !newSpecificLimit || !oldSpecificLimit) {
    return "";
  }
  if (newSpecificLimit < oldSpecificLimit) {
    return "";
  }
  const url = urlWithoutSearchParams(currentUrl);
  url.searchParams.set("contractAddress", contractAddress);
  url.searchParams.set("tokenAddress", tokenAddress!);
  url.searchParams.set(
    "riskLimitSpecificLimit",
    encodeTokenAmount(newSpecificLimit)
  );
  return url.href;
}

const SpecificRiskLimitsPanel = ({
  readOnlyRpcProv,
  contractAddress,
  walletInfo,
  ethTokenAddress,
  votesRequired,
}: {
  readOnlyRpcProv: Web3;
  walletInfo?: WalletInfo;
  contractAddress: string;
  ethTokenAddress: string;
  votesRequired: boolean;
}) => {
  const [tokenAddress, setTokenAddress] = useState<string>("");
  const [initialLimit, setInititalLimit] = useState<string | null>(null);
  const [specificLimit, setSpecificLimit] = useState<number | null>(null);

  const handleLimitFetch = async () => {
    if (!tokenAddress) {
      return;
    }
    const { specificLimit } = await fetchSpecificRiskLimit(
      readOnlyRpcProv,
      contractAddress,
      tokenAddress
    );
    setInititalLimit(String(specificLimit));
  };
  const handleSubmit = async () => {
    if (specificLimit == null || !tokenAddress) {
      alert("Must set a limit value and token address");
    }
    if (Number(specificLimit) == 0) {
      const res = confirm(
        "Setting limit to zero means all spending for this token must be pre-approved, are you sure?"
      );

      if (!res) return;
    }
    await setSpecificRiskLimit(
      contractAddress,
      tokenAddress,
      encodeTokenAmount(specificLimit!),
      walletInfo!,
      specificLimit! > Number(ethers.formatUnits(initialLimit!, 18))
    );
  };
  const specificLimitVoteLink = voteSpecificLimitLink(
    window.location.href,
    specificLimit,
    initialLimit ? Number(ethers.formatUnits(initialLimit, 18)) : null,
    contractAddress,
    tokenAddress
  );
  return (
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
      <div>Token-specific limits:</div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignContent: "flex-start",
          textAlign: "left",
        }}
      >
        <label htmlFor="tokenAddressInput">Token address</label>
        <div style={{ fontSize: "0.8em" }}>
          ETH address: <em>{ethTokenAddress}</em>
        </div>
        <input
          type="text"
          placeholder="Address of token"
          value={tokenAddress!}
          id="tokenAddressInput"
          name="tokenAddressInput"
          onChange={(e) => setTokenAddress(e.target.value)}
        />
        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <button
            className={"btn-secondary"}
            disabled={tokenAddress === ""}
            onClick={handleLimitFetch}
          >
            Fetch limit for token
          </button>
        </div>
      </div>
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
          value={ethers.formatUnits(initialLimit || "0", 18)}
          disabled={true}
        />
        <label htmlFor="newLimitInput">Set to</label>
        <input
          type="number"
          placeholder="New limit e.g. 0.01"
          value={specificLimit!}
          id="newLimitInput"
          name="newLimitInput"
          min="0"
          onChange={(e) => setSpecificLimit(Number(e.target.value))}
        />
      </div>
      <div>
        Guardians can vote (gasless) for this change at:
        <div className="link-block">
          {votesRequired && specificLimitVoteLink
            ? specificLimitVoteLink
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
            disabled={votesRequired && specificLimitVoteLink !== ""}
            onClick={handleSubmit}
          >
            {votesRequired && specificLimitVoteLink !== ""
              ? "Change by guardian voting (risk increase)"
              : "Submit change"}
          </button>
        </div>
      </div>
    </div>
  );
};

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
  const [etherTokenAddress, setEtherTokenAddress] = useState<string | null>(
    null
  );
  const [newTimeWindow, setNewTimeWindow] = useState<number | null>(null);
  const [newDefaultLimit, setNewDefaultLimit] = useState<number | null>(null);

  useEffect(() => {
    if (!initialDefaultLimit && contractAddress) {
      fetchRiskLimitDetails(readOnlyRpcProv, contractAddress!).then(
        ({ defaultLimit, timeWindow, numVotes, etherTokenAddress }) => {
          setInitialDefaultLimit(String(defaultLimit));
          setInitialTimeWindow(String(timeWindow));
          setNumVotes(String(numVotes));
          setEtherTokenAddress(String(etherTokenAddress));
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
  const handleTimeWindowSubmit = async () => {
    if (newTimeWindow == null) {
      alert("Must set a time window value");
    }
    if (newTimeWindow === 0) {
      const res = confirm(
        "Setting time window to zero means RISK LIMITS ARE TOTALLY DISABLED, are you sure?"
      );

      if (!res) return;
    }
    await setRiskLimitTimeWindow(
      contractAddress,
      String(newTimeWindow),
      walletInfo!,
      newTimeWindow! > Number(initialTimeWindow!)
    );
  };
  const handleDefaultLimitSubmit = async () => {
    if (newDefaultLimit == null) {
      alert("Must set a default limit value");
    }
    if (newDefaultLimit === 0) {
      const res = confirm(
        "Setting default limit to zero means all spending must be pre-approved, are you sure?"
      );

      if (!res) return;
    }
    await setDefaultRiskLimit(
      contractAddress,
      encodeTokenAmount(newDefaultLimit!),
      walletInfo!,
      newDefaultLimit! > Number(ethers.formatUnits(initialDefaultLimit!, 18))
    );
  };
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
          <label htmlFor="newTimeWindowInput">Set to</label>
          <input
            type="number"
            placeholder="New time window"
            value={newTimeWindow!}
            id="newTimeWindowInput"
            name="newTimeWindowInput"
            step="1"
            min="0"
            onChange={(e) => setNewTimeWindow(Number(e.target.value))}
          />
        </div>
        <div>
          Guardians can vote (gasless) for this change at:
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
              onClick={handleTimeWindowSubmit}
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
          <label htmlFor="newDefaultLimitInput">Set to</label>
          <input
            type="number"
            placeholder="New limit e.g. 0.01"
            value={newDefaultLimit!}
            id="newDefaultLimitInput"
            name="newDefaultLimitInput"
            min="0"
            onChange={(e) => setNewDefaultLimit(Number(e.target.value))}
          />
        </div>
        <div>
          Guardians can vote (gasless) for this change at:
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
              onClick={handleDefaultLimitSubmit}
            >
              {votesRequired && defaultLimitVoteLink !== ""
                ? "Change by guardian voting (risk increase)"
                : "Submit change"}
            </button>
          </div>
        </div>
      </div>

      <hr />
      <SpecificRiskLimitsPanel
        readOnlyRpcProv={readOnlyRpcProv}
        walletInfo={walletInfo}
        contractAddress={contractAddress}
        ethTokenAddress={etherTokenAddress!}
        votesRequired={votesRequired}
      />
    </div>
  );
};
