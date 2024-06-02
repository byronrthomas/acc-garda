import Web3 from "web3";
import { formatChainAsNum } from "../utils";
import accountContractAbi from "./contractAbi.json";
import ownershipRegistryAbi from "./ownershipRegistryAbi.json";
import riskManagerAbi from "./riskManagerAbi.json";
import { WalletInfo } from "../WalletProvidersList";
import { utils, BrowserProvider } from "zksync-ethers";

import { encodeFunctionCall } from "web3-eth-abi";
import { TransactionLike } from "zksync-ethers/build/types";
import { EIP712_TX_TYPE, serializeEip712 } from "zksync-ethers/build/utils";
import { TransactionResponse, ethers, TransactionReceipt } from "ethers";
import { urlForContract } from "../utils/links";

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

export function encodeCallUsingAbi(
  contractAbi: any,
  methodName: string,
  args: any[]
): string {
  const functionAbi = contractAbi.find((abi: any) => abi.name === methodName);
  if (!functionAbi) {
    throw new Error(`${methodName} not found in contract ABI`);
  }
  return encodeFunctionCall(functionAbi, args);
}

export async function voteToApproveTransfer(
  walletInfo: WalletInfo,
  contractAddress: string,
  newOwnerAddress: string,
  ownershipRegistryAddress: string
) {
  const data = encodeCallUsingAbi(ownershipRegistryAbi, "voteForNewOwner", [
    // Voting to change owner of contract (account) address to be newOwnerAddress
    contractAddress,
    newOwnerAddress,
  ]);

  const rpc = initChainReadRPC();
  const rsp = await sendFromWalletWithPaymaster(
    rpc,
    walletInfo,
    ownershipRegistryAddress,
    data,
    contractAddress
  );
  if (rsp) {
    console.log("Got response", rsp);
    if (rsp!.hash) {
      alert("You have sent your vote - transaction hash: " + rsp.hash);
      const redirectTo = urlForContract(contractAddress);
      // reload window with this address
      window.location.href = redirectTo;
    }
  }
  return rsp;
}

export async function voteToApproveSpendAllowance(
  walletInfo: WalletInfo,
  contractAddress: string,
  tokenAddress: string,
  newAllowanceAmount: string,
  rpc: Web3,
  riskManagerAddress: string
) {
  const data = encodeCallUsingAbi(riskManagerAbi, "voteForSpendAllowance", [
    contractAddress,
    tokenAddress,
    newAllowanceAmount,
  ]);
  const rsp = await sendFromWalletWithPaymaster(
    rpc,
    walletInfo,
    riskManagerAddress,
    data,
    contractAddress
  );
  if (rsp) {
    console.log("Got response", rsp);
    if (rsp!.hash) {
      alert("You have sent your vote - transaction hash: " + rsp.hash);
      const redirectTo = urlForContract(contractAddress);
      // reload window with this address
      window.location.href = redirectTo;
    }
  }
  return rsp;
}

export async function voteForDefaultRiskLimitIncrease(
  walletInfo: WalletInfo,
  contractAddress: string,
  newLimit: string,
  rpc: Web3,
  riskManagerAddress: string
) {
  const data = encodeCallUsingAbi(
    riskManagerAbi,
    "voteForDefaultRiskLimitIncrease",
    [contractAddress, newLimit]
  );
  const rsp = await sendFromWalletWithPaymaster(
    rpc,
    walletInfo,
    riskManagerAddress,
    data,
    contractAddress
  );
  if (rsp) {
    console.log("Got response", rsp);
    if (rsp!.hash) {
      alert("You have sent your vote - transaction hash: " + rsp.hash);
      const redirectTo = urlForContract(contractAddress);
      // reload window with this address
      window.location.href = redirectTo;
    }
  }
  return rsp;
}

export async function voteForSpecificRiskLimitIncrease(
  walletInfo: WalletInfo,
  contractAddress: string,
  tokenAddress: string,
  newLimit: string,
  rpc: Web3,
  riskManagerAddress: string
) {
  const data = encodeCallUsingAbi(
    riskManagerAbi,
    "voteForSpecificRiskLimitIncrease",
    [contractAddress, tokenAddress, newLimit]
  );
  const rsp = await sendFromWalletWithPaymaster(
    rpc,
    walletInfo,
    riskManagerAddress,
    data,
    contractAddress
  );
  if (rsp) {
    console.log("Got response", rsp);
    if (rsp!.hash) {
      alert("You have sent your vote - transaction hash: " + rsp.hash);
      const redirectTo = urlForContract(contractAddress);
      // reload window with this address
      window.location.href = redirectTo;
    }
  }
  return rsp;
}

export async function voteForRiskLimitTimeWindowDecrease(
  walletInfo: WalletInfo,
  contractAddress: string,
  newWindow: string,
  rpc: Web3,
  riskManagerAddress: string
) {
  const data = encodeCallUsingAbi(
    riskManagerAbi,
    "voteForRiskLimitTimeWindowDecrease",
    [contractAddress, newWindow]
  );
  const rsp = await sendFromWalletWithPaymaster(
    rpc,
    walletInfo,
    riskManagerAddress,
    data,
    contractAddress
  );
  if (rsp) {
    console.log("Got response", rsp);
    if (rsp!.hash) {
      alert("You have sent your vote - transaction hash: " + rsp.hash);
      const redirectTo = urlForContract(contractAddress);
      // reload window with this address
      window.location.href = redirectTo;
    }
  }
  return rsp;
}

export async function sendFromWalletWithPaymaster(
  rpc: Web3,
  walletInfo: WalletInfo,
  contractAddress: string,
  data: string,
  paymasterAddress?: string
): Promise<TransactionReceipt | undefined> {
  const paymasterParams = utils.getPaymasterParams(
    // Assume paymaster is called contract when not specified
    paymasterAddress ?? contractAddress,
    {
      type: "General",
      innerInput: new Uint8Array(),
    }
  );
  const mySigner = await new BrowserProvider(
    walletInfo.provider.provider
  ).getSigner();

  const gasPrice = await rpc.eth.getGasPrice();
  console.log("Sending transaction to", contractAddress);
  console.log("From", walletInfo.userAccount);
  console.log("Sending transaction with data", data);
  console.log("Gas price", gasPrice);

  const myN2 = await rpc.eth.getTransactionCount(walletInfo.userAccount);
  // console.log("myNonce2", myN2);
  // convert from bigint to a number
  const myN2n = Number(myN2);
  // console.log("myNonce2n", myN2n);

  const chainId = (await mySigner.provider.getNetwork()).chainId;
  // console.log("myChainId", chainId);
  const filledCustomData = mySigner._fillCustomData({
    gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    paymasterParams,
  });
  // console.log("filledCustomData", filledCustomData);
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

  return mySigner.provider
    .broadcastTransaction(txBytes)
    .then(
      (rsp) => rsp.wait(),
      (e) => {
        console.error("Error sending transaction", e);
        alert("Error sending transaction: " + e.message);
        return undefined;
      }
    )
    .then(
      (rsp) => rsp,
      (e) => {
        console.error("Error in transaction", e);
        alert("Error in transaction: " + e.message);
        return undefined;
      }
    );

  // let rsp: TransactionResponse | undefined = undefined;

  // try {
  //   rsp = await mySigner.provider.broadcastTransaction(txBytes);
  // } catch (e: any) {
  //   console.error("Error sending transaction", e);
  //   alert("Error sending transaction: " + e.message);
  //   const redirectTo = urlForContract(contractAddress);
  //   // reload window with this address
  //   window.location.href = redirectTo;
  // }

  // try {

  // }

  // return rsp;
}

export function initChainReadRPC() {
  const provider = new Web3.providers.HttpProvider(
    import.meta.env.VITE_TESTNET_RPC
  );
  return new Web3(provider);
}

export type AccountContractDetails = {
  displayName: string;
  ownerAddress: string;
  etherTokenAddress: string;
  ownershipRegistryAddress: string;
  riskManagerAddress: string;
};
export async function fetchOwnerDetails(
  provider: Web3,
  contractAddress: string
): Promise<AccountContractDetails> {
  const contract = new provider.eth.Contract(
    accountContractAbi,
    contractAddress!
  );
  const ownershipRegistryAddress = await contract.methods
    .ownershipRegistry()
    .call();
  const riskManagerAddress = String(
    await contract.methods.riskManager().call()
  );

  const etherTokenAddress = await contract.methods.ETH_TOKEN_ADDRESS().call();
  const ownershipRegContract = new provider.eth.Contract(
    ownershipRegistryAbi,
    String(ownershipRegistryAddress)
  );
  const ownerDisplayName = await ownershipRegContract.methods
    .accountOwnerDisplayName(contractAddress)
    .call();
  console.log("ownerDisplayName", ownerDisplayName);
  const ownerAddress = await ownershipRegContract.methods
    .accountOwner(contractAddress)
    .call();

  return {
    displayName: String(ownerDisplayName),
    ownerAddress: String(ownerAddress),
    etherTokenAddress: String(etherTokenAddress),
    ownershipRegistryAddress: String(ownershipRegistryAddress),
    riskManagerAddress: String(riskManagerAddress),
  };
}

export type RiskLimitDetails = {
  defaultLimit: string;
  timeWindow: string;
  numVotes: string;
};
export async function fetchRiskLimitDetails(
  provider: Web3,
  contractAddress: string,
  riskManagerAddress: string
): Promise<RiskLimitDetails> {
  const riskManagerContract = new provider.eth.Contract(
    riskManagerAbi,
    riskManagerAddress
  );
  const defaultLimit = await riskManagerContract.methods
    .defaultRiskLimit(contractAddress)
    .call();
  const timeWindow = await riskManagerContract.methods
    .riskLimitTimeWindow(contractAddress)
    .call();
  const numVotes = await riskManagerContract.methods
    .numVotesRequired(contractAddress)
    .call();
  return {
    defaultLimit: String(defaultLimit),
    timeWindow: String(timeWindow),
    numVotes: String(numVotes),
  };
}

export async function fetchSpecificRiskLimit(
  provider: Web3,
  contractAddress: string,
  riskManagerAddress: string,
  tokenAddress: string
) {
  const riskMgrContract = new provider.eth.Contract(
    riskManagerAbi,
    riskManagerAddress
  );
  const specificLimit = await riskMgrContract.methods
    .limitForToken(contractAddress, tokenAddress)
    .call();
  return { specificLimit };
}

export async function setSpecificRiskLimit(
  contractAddress: string,
  tokenAddress: string,
  newLimit: string,
  walletInfo: WalletInfo,
  isIncrease: boolean
) {
  const methodName = isIncrease
    ? "increaseSpecificRiskLimit"
    : "decreaseSpecificRiskLimit";
  console.log("methodName", methodName);
  const functionAbi = accountContractAbi.find((abi) => abi.name === methodName);
  if (!functionAbi) {
    throw new Error(`${methodName} not found in contract ABI`);
  }
  // ignore the type checking for next line
  // @ts-ignore
  const data = encodeFunctionCall(functionAbi, [tokenAddress, newLimit]);
  await sendSmartAccountTx(
    { to: contractAddress, value: null, data },
    contractAddress,
    walletInfo
  );
}

export async function setDefaultRiskLimit(
  contractAddress: string,
  newLimit: string,
  walletInfo: WalletInfo,
  isIncrease: boolean
) {
  const methodName = isIncrease
    ? "increaseDefaultRiskLimit"
    : "decreaseDefaultRiskLimit";
  console.log("methodName", methodName);
  const functionAbi = accountContractAbi.find((abi) => abi.name === methodName);
  if (!functionAbi) {
    throw new Error(`${methodName} not found in contract ABI`);
  }
  // ignore the type checking for next line
  // @ts-ignore
  const data = encodeFunctionCall(functionAbi, [newLimit]);
  await sendSmartAccountTx(
    { to: contractAddress, value: null, data },
    contractAddress,
    walletInfo
  );
}

export async function setRiskLimitTimeWindow(
  contractAddress: string,
  newWindow: string,
  walletInfo: WalletInfo,
  isIncrease: boolean
) {
  const methodName = isIncrease
    ? "increaseRiskLimitTimeWindow"
    : "decreaseRiskLimitTimeWindow";
  console.log("methodName", methodName);
  const functionAbi = accountContractAbi.find((abi) => abi.name === methodName);
  if (!functionAbi) {
    throw new Error(`${methodName} not found in contract ABI`);
  }
  // ignore the type checking for next line
  // @ts-ignore
  const data = encodeFunctionCall(functionAbi, [newWindow]);
  await sendSmartAccountTx(
    { to: contractAddress, value: null, data },
    contractAddress,
    walletInfo
  );
}

export async function allowTimeDelayedTransaction(
  contractAddress: string,
  tokenAddress: string,
  newAllowance: string,
  validFromSeconds: number,
  walletInfo: WalletInfo
) {
  const data = encodeCallUsingAbi(
    accountContractAbi,
    "allowTimeDelayedTransaction",
    [tokenAddress, newAllowance, validFromSeconds]
  );
  const rsp = await sendSmartAccountTx(
    { to: contractAddress, value: null, data },
    contractAddress,
    walletInfo
  );
  return rsp;
}

export async function sendSmartAccountTx(
  txInfo: { to: string; value: string | null; data: string | null },
  contractAddress: string,
  walletInfo: WalletInfo
): Promise<TransactionReceipt | undefined> {
  console.log("Sending transaction to", contractAddress);
  console.log("From", walletInfo.userAccount);
  console.log("Sending transaction with data", txInfo.data);

  const mySigner = await new BrowserProvider(
    walletInfo.provider.provider
  ).getSigner();

  console.log("mySigner", mySigner);

  const rpc = initChainReadRPC();
  const myN2 = await rpc.eth.getTransactionCount(contractAddress);
  // convert from bigint to a number
  const myN2n = Number(myN2);
  const gasPrice = await rpc.eth.getGasPrice();

  const chainId = (await mySigner.provider.getNetwork()).chainId;
  const filledCustomData = mySigner._fillCustomData({});
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

  return mySigner.provider
    .broadcastTransaction(txBytes)
    .then(
      (rsp) => rsp.wait(),
      (e) => {
        console.error("Error sending transaction", e);
        alert("Error sending transaction: " + e.message);
        return undefined;
      }
    )
    .then(
      (rsp) => {
        if (rsp) {
          console.log("Got response", rsp);
          if (rsp.hash) {
            alert(
              "You have sent the transaction - transaction hash: " + rsp.hash
            );
          }
          return rsp;
        }
      },
      (e) => {
        console.error("Error in transaction", e);
        alert("Error in transaction: " + e.message);
        return undefined;
      }
    );
  // let rsp: TransactionResponse | undefined = undefined;
  // try {
  //   rsp = await mySigner.provider.broadcastTransaction(txBytes);
  // } catch (e: any) {
  //   console.error("Error sending transaction", e);
  //   alert("Error sending transaction: " + e.message);
  // }

  // if (rsp) {
  //   console.log("Got response", rsp);
  //   if (rsp.hash) {
  //     alert("You have sent the transaction - transaction hash: " + rsp.hash);
  //   }
  // }

  // return rsp;
}
