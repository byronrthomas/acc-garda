import Web3 from "web3";
import { formatChainAsNum } from "../utils";
import contractAbi from "./contractAbi.json";
import { WalletInfo } from "../WalletProvidersList";

import { encodeFunctionCall } from "web3-eth-abi";

export async function detectNetwork(provider: EIP1193Provider) {
  const chainId = await provider // Or window.ethereum if you don't support EIP-6963.
    .request({ method: "eth_chainId" });
  console.log("Currently on chain", chainId);
  // chainId should be a string that is either in hex or decimal format.
  // return it as an integer. If it is in hex it should start 0x, otherwise
  // it should be a decimal number.
  return formatChainAsNum(String(chainId));
}

export async function switchNetwork(
  provider: EIP1193Provider,
  newChainId: string
) {
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: newChainId }],
    });
    return { success: true };
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to MetaMask.
    if (switchError.code === 4902) {
      return {
        success: false,
        errorMessage:
          "Network doesn't exist. Please add the network details for it to your wallet provider (e.g. MetaMask)",
      };
    } else {
      return { success: false, errorMessage: switchError.message };
    }
  }
}

export async function voteToApproveTransfer(
  walletInfo: WalletInfo,
  contractAddress: string,
  newOwnerAddress: string
) {
  const functionAbi = contractAbi.find((abi) => abi.name === "voteForNewOwner");
  if (!functionAbi) {
    throw new Error("voteForNewOwner not found in contract ABI");
  }

  // ignore the type checking for next line
  // @ts-ignore
  const data = encodeFunctionCall(functionAbi, [newOwnerAddress]);

  walletInfo.provider.provider // Or window.ethereum if you don't support EIP-6963.
    .request({
      method: "eth_sendTransaction",
      // The following sends an EIP-1559 transaction. Legacy transactions are also supported.
      params: [
        {
          // The user's active address.
          from: walletInfo.userAccount,
          // Required except during contract publications.
          to: contractAddress,
          data: data,
        },
      ],
    })
    .then((txHash) => console.log(txHash))
    .catch((error) => console.error(error));
}

export function initChainReadRPC() {
  const provider = new Web3.providers.HttpProvider(
    import.meta.env.VITE_TESTNET_RPC
  );
  return new Web3(provider);
}

export async function fetchDisplayName(
  provider: Web3,
  contractAddress: string
) {
  const contract = new provider.eth.Contract(contractAbi, contractAddress!);
  const ownerDisplayName = await contract.methods.ownerDisplayName().call();
  return ownerDisplayName;
}
