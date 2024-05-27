import { ethers } from "ethers";
import { SmartAccountDetails } from "../deploy/deploy";
import { getWallet, sendSmartAccountTransaction } from "./utils";

// This script is used to recover assets from the smart account back to the owner
// Once in a non-smart account, it's a lot easier to interact with the assets using
// standard Ethereum tools

// Important: make sure to change the contract address and private key
export default async function ethBackToOwner() {
  const walletKey = process.env.OWNER_PRIVATE_KEY;
  const contractAddress = process.env.SMART_ACCOUNT_ADDRESS;

  if (!walletKey) {
    throw "⛔️ Wallet private key wasn't found in .env file OR OWNER_PRIVATE_KEY environment variable!";
  }
  if (!contractAddress) {
    throw "⛔️ Smart account address wasn't found in .env file OR SMART_ACCOUNT_ADDRESS environment variable!";
  }
  const wallet = getWallet(walletKey);
  const accountDetails: Omit<SmartAccountDetails, "contractInterface"> = {
    accountAddress: contractAddress,
    ownerAddress: wallet.address,
    ownerPrivateKey: walletKey,
  };

  console.log(
    `Aiming to recover ETH from ${contractAddress} to ${wallet.address}`
  );
  const tx = await sendSmartAccountTransaction(
    accountDetails,
    wallet.provider,
    { value: ethers.parseEther("0.019"), to: wallet.address }
  );
}

ethBackToOwner();
