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
      <input
        type="text"
        placeholder="New owner address"
        onChange={handleChange}
        value={newAddress}
      />
      <div>
        You should share the following link with your account guardians:
        <div className="link-block">
          {makeLink(window.location.href, newAddress, contractAddress)}
        </div>
      </div>
    </div>
  );
};
