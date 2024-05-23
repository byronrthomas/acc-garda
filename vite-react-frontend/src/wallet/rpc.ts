import { formatChainAsNum } from "../utils";

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
