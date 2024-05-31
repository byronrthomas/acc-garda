import { useState } from "react";
import { urlWithoutSearchParams } from "../utils/links";

function makeLink(
  windowLocation: string,
  newOwnerAddress: string,
  contractAddress: string
) {
  if (!windowLocation || !newOwnerAddress) {
    return "";
  }
  const url = urlWithoutSearchParams(windowLocation);
  url.searchParams.append("newOwnerAddress", newOwnerAddress);
  url.searchParams.append("contractAddress", contractAddress);
  return url.toString();
}

export const OwnerChangeLinkPanel = ({
  contractAddress,
}: {
  contractAddress: string;
}) => {
  const [newAddress, setNewAddress] = useState<string>("");
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewAddress(e.target.value);
  };
  return (
    <div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          alignContent: "flex-start",
          textAlign: "left",
        }}
      >
        <label>Your new address:</label>
        <input
          type="text"
          placeholder="New owner address (e.g. 0xee75...)"
          onChange={handleChange}
          value={newAddress}
        />
      </div>
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
        Guardians can vote for this change at:
        <div className="link-block">
          {makeLink(window.location.href, newAddress, contractAddress)}
        </div>
      </div>
    </div>
  );
};
