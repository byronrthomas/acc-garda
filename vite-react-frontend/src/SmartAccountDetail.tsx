import { useEffect, useState } from "react";
import { fetchDisplayName } from "./wallet/rpc";
import Web3 from "web3";

export const SmartAccountDetail = ({
  readOnlyRpcProv,
}: {
  readOnlyRpcProv: Web3;
}) => {
  const [displayName, setDisplayName] = useState<string | null>(null);

  useEffect(() => {
    fetchDisplayName(readOnlyRpcProv).then((name) => {
      setDisplayName(String(name));
    });
  }, [readOnlyRpcProv]);

  return displayName === null ? (
    <div>Loading...</div>
  ) : (
    <div>
      You are interacting with the Smart Account originally owned by{" "}
      {displayName}
    </div>
  );
};
