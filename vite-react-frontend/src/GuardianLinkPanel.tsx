import { useState } from "react";

function makeLink(
  windowLocation: string,
  newOwnerAddress: string,
  contractAddress: string
) {
  if (!windowLocation || !newOwnerAddress) {
    return "";
  }
  const url = new URL(windowLocation);
  url.searchParams.append("newOwnerAddress", newOwnerAddress);
  url.searchParams.delete("contractAddress");
  url.searchParams.append("contractAddress", contractAddress);
  return url.toString();
}

export const GuardianLinkPanel = ({
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
        }}
      >
        <label>Your new address:</label>
        <input
          type="text"
          placeholder="New owner address"
          onChange={handleChange}
          value={newAddress}
        />
      </div>
      <hr />

      <div>
        Guardians can vote for this change at:
        <div className="link-block">
          {makeLink(window.location.href, newAddress, contractAddress)}
        </div>
      </div>
    </div>
  );
};
