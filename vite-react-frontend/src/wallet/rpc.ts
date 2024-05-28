import Web3 from "web3";
import { formatChainAsNum } from "../utils";
import contractAbi from "./contractAbi.json";
import { WalletInfo } from "../WalletProvidersList";
import { utils, BrowserProvider } from "zksync-ethers";

import { encodeFunctionCall } from "web3-eth-abi";
import { TransactionLike } from "zksync-ethers/build/types";
import { EIP712_TX_TYPE, serializeEip712 } from "zksync-ethers/build/utils";
import { TransactionResponse, ethers } from "ethers";

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
  newOwnerAddress: string,
  gasPrice: bigint
) {
  const functionAbi = contractAbi.find((abi) => abi.name === "voteForNewOwner");
  if (!functionAbi) {
    throw new Error("voteForNewOwner not found in contract ABI");
  }

  // ignore the type checking for next line
  // @ts-ignore
  const data = encodeFunctionCall(functionAbi, [newOwnerAddress]);
  console.log("Sending transaction to", contractAddress);
  console.log("From", walletInfo.userAccount);
  console.log("Sending transaction with data", data);
  console.log("Gas price", gasPrice);
  const paymasterParams = utils.getPaymasterParams(contractAddress, {
    type: "General",
    innerInput: new Uint8Array(),
  });

  const mySigner = await new BrowserProvider(
    walletInfo.provider.provider
  ).getSigner();

  console.log("mySigner", mySigner);

  const rpc = initChainReadRPC();
  const myN2 = await rpc.eth.getTransactionCount(walletInfo.userAccount);
  console.log("myNonce2", myN2);
  // convert from bigint to a number
  const myN2n = Number(myN2);
  console.log("myNonce2n", myN2n);

  const chainId = (await mySigner.provider.getNetwork()).chainId;
  console.log("myChainId", chainId);
  const filledCustomData = mySigner._fillCustomData({
    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    paymasterParams,
  });
  console.log("filledCustomData", filledCustomData);
  const tx: TransactionLike = {
    type: EIP712_TX_TYPE,
    value: 0,
    data: data,
    nonce: myN2n,
    gasPrice: gasPrice,
    gasLimit: 6000000,
    chainId: chainId,
    to: contractAddress,
    customData: filledCustomData,
    from: walletInfo.userAccount,
  };
  console.log("About to sign", tx);
  const s1 = await mySigner.eip712.sign(tx);
  console.log("Signed", s1);
  tx.customData!.customSignature = s1;
  console.log("About to serialize", tx);
  const txBytes = serializeEip712(tx);
  console.log("About to send", txBytes);

  let rsp: TransactionResponse | undefined = undefined;
  try {
    rsp = await mySigner.provider.broadcastTransaction(txBytes);
  } catch (e: any) {
    console.error("Error sending transaction", e);
    alert("Error sending transaction: " + e.message);
  }

  if (rsp) {
    console.log("Got response", rsp);
    if (rsp.hash) {
      alert("You have sent the transaction - transaction hash: " + rsp.hash);
    }
  }

  return rsp;
}

export function initChainReadRPC() {
  const provider = new Web3.providers.HttpProvider(
    import.meta.env.VITE_TESTNET_RPC
  );
  return new Web3(provider);
}

export async function fetchOwnerDetails(
  provider: Web3,
  contractAddress: string
) {
  const contract = new provider.eth.Contract(contractAbi, contractAddress!);
  const ownerDisplayName = await contract.methods.ownerDisplayName().call();
  const ownerAddress = await contract.methods.owner().call();
  return { displayName: ownerDisplayName, address: ownerAddress };
}

export async function sendSmartAccountTx(
  txInfo: { to: string; value: string | null; data: string | null },
  contractAddress: string,
  walletInfo: WalletInfo
) {
  console.log("Sending transaction to", contractAddress);
  console.log("From", walletInfo.userAccount);
  console.log("Sending transaction with data", txInfo.data);

  const mySigner = await new BrowserProvider(
    walletInfo.provider.provider
  ).getSigner();

  console.log("mySigner", mySigner);

  const rpc = initChainReadRPC();
  const myN2 = await rpc.eth.getTransactionCount(walletInfo.userAccount);
  console.log("myNonce2", myN2);
  // convert from bigint to a number
  const myN2n = Number(myN2);
  console.log("myNonce2n", myN2n);
  const gasPrice = await rpc.eth.getGasPrice();
  console.log("Gas price", gasPrice);

  const chainId = (await mySigner.provider.getNetwork()).chainId;
  console.log("myChainId", chainId);
  const filledCustomData = mySigner._fillCustomData({});
  console.log("filledCustomData", filledCustomData);
  const tx: TransactionLike = {
    type: EIP712_TX_TYPE,
    value: txInfo.value ? ethers.parseEther(txInfo.value!) : 0,
    data: txInfo.data ?? "0x",
    nonce: myN2n,
    gasPrice: gasPrice,
    gasLimit: 6000000,
    chainId: chainId,
    to: txInfo.to,
    customData: filledCustomData,
    from: contractAddress,
  };
  console.log("About to sign", tx);
  const s1 = await mySigner.eip712.sign(tx);
  console.log("Signed", s1);
  tx.customData!.customSignature = s1;
  console.log("About to serialize", tx);
  const txBytes = serializeEip712(tx);
  console.log("About to send", txBytes);

  let rsp: TransactionResponse | undefined = undefined;
  try {
    rsp = await mySigner.provider.broadcastTransaction(txBytes);
  } catch (e: any) {
    console.error("Error sending transaction", e);
    alert("Error sending transaction: " + e.message);
  }

  if (rsp) {
    console.log("Got response", rsp);
    if (rsp.hash) {
      alert("You have sent the transaction - transaction hash: " + rsp.hash);
    }
  }

  return rsp;
}
