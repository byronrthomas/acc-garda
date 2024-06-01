import * as ethers from "ethers";
import { LOCAL_RICH_WALLETS, getWallet } from "../scripts/utils";
import hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Contract, Wallet, utils } from "zksync-ethers";
import { transferEth } from "../scripts/utils";
import {
  deployAccountFactory,
  AccountFactoryDetail,
} from "./deployAccountFactory";

export type SmartAccountDetails = {
  /**
   * Address of the smart account
   */
  accountAddress: string;
  /**
   * Private key of the owner of the smart account
   */
  ownerPrivateKey: string;
  /**
   * Address of the owner of the smart account
   */
  ownerAddress: string;
  /**
   * Interface of the smart account contract
   */
  contractInterface: ethers.Interface;
};

export type AccountInfo = {
  guardianAddresses: string[];
  guardianApprovalThreshold: number;
  displayName: string;
  riskLimitTimeWindowSecs: number;
  riskLimitDefaultLimit: bigint;
};

export async function setupUserAccount(
  wallet: Wallet,
  info: AccountInfo,
  ownerAddress: string,
  silentDeploy?: boolean
) {
  // Credit: the initial implementation of this takes heavy pointers from the example code in the ZKSync docs:
  // https://docs.zksync.io/build/tutorials/smart-contract-development/account-abstraction/daily-spend-limit.html
  const factoryDetails = await deployAccountFactory(wallet, silentDeploy);
  console.log(`Account factory address: ${factoryDetails.factoryAddress}`);

  return setupAccountFromFactory(wallet, info, ownerAddress, factoryDetails);
}

async function setupAccountFromFactory(
  wallet: Wallet,
  info: AccountInfo,
  ownerAddress: string,
  factoryDetails: AccountFactoryDetail
) {
  const salt = ethers.randomBytes(32);
  const tx = await factoryDetails.factoryContract.deployAccount(
    salt,
    ownerAddress,
    info.guardianAddresses,
    info.guardianApprovalThreshold,
    info.displayName,
    info.riskLimitTimeWindowSecs,
    info.riskLimitDefaultLimit
  );
  await tx.wait();

  const abiCoder = new ethers.AbiCoder();
  const accountAddress = utils.create2Address(
    factoryDetails.factoryAddress,
    await factoryDetails.factoryContract.accountBytecodeHash(),
    salt,
    abiCoder.encode(
      [
        "address",
        "address",
        "address[]",
        "uint16",
        "string",
        "uint256",
        "uint256",
      ],
      [
        factoryDetails.factoryAddress,
        ownerAddress,
        info.guardianAddresses,
        info.guardianApprovalThreshold,
        info.displayName,
        info.riskLimitTimeWindowSecs,
        info.riskLimitDefaultLimit,
      ]
    )
  );
  const accountContract = new Contract(
    accountAddress,
    factoryDetails.accountArtifactAbi,
    wallet
  );

  console.log(`SC Account deployed on address ${accountAddress}`);
  const accountInfo = await wallet.provider.getContractAccountInfo(
    accountAddress
  );
  console.log("Account Info: ", accountInfo);
  if (accountInfo.supportedAAVersion.toString() !== "1") {
    throw new Error(
      `Account ${accountAddress} does not appear to be a correctly deployed smart account!`
    );
  }
  return {
    accountAddress,
    ownerAddress: ownerAddress,
    contractInterface: accountContract.interface,
  };
}

export async function setupUserAccountForTest(
  wallet: Wallet,
  info: AccountInfo,
  silentDeploy?: boolean
): Promise<SmartAccountDetails> {
  // Credit: the initial implementation of this takes heavy pointers from the example code in the ZKSync docs:
  // https://docs.zksync.io/build/tutorials/smart-contract-development/account-abstraction/daily-spend-limit.html
  const owner = Wallet.createRandom();
  console.log("SC Account owner pk: ", owner.privateKey);
  console.log("SC Account owner address: ", owner.address);

  const accountDetails = await setupUserAccount(wallet, info, owner.address);

  console.log("Funding smart contract account with some ETH");
  await transferEth(wallet, accountDetails.accountAddress, "0.02");
  console.log(`Done!`);
  return {
    ...accountDetails,
    ownerPrivateKey: owner.privateKey,
    ownerAddress: owner.address,
  };
}

export default async function () {
  // TO use LOCAL_RICH_WALLETS[0].privateKey), add WALLET_PRIVATE_KEY="0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110" to the start of your command
  const deploymentWallet = getWallet();
  const blockNum = await deploymentWallet.provider.getBlockNumber();
  const networkId = await deploymentWallet.provider.getNetwork();
  console.log(
    `Current block number: ${blockNum} on network ID: ${networkId.chainId}`
  );
  const allGuardians = [];
  const guardians = process.env.GUARDIANS;
  if (guardians) {
    const guardianArray = JSON.parse(guardians);
    // Add all guardians to the list
    // @ts-ignore
    allGuardians.push(...guardianArray);
  }
  const numSignatures = parseInt(process.env.NUM_APPROVALS_REQUIRED || "0");
  if (allGuardians.length == 0) {
    console.warn(
      "With no guardians, it won't be possible to change the owner."
    );
  } else if (numSignatures == 0) {
    console.warn(
      "With ZERO required signatures, any guardian can change the owner without further approvals - set NUM_SIGNATUES_REQUIRED if you do not want this."
    );
  }
  const ownerDisplayName = process.env.OWNER_DISPLAY_NAME || "Test Account";
  const ownerAddress = process.env.OWNER_ADDRESS || deploymentWallet.address;
  if (!process.env.OWNER_ADDRESS) {
    console.warn(
      "No owner address specified, using deployment wallet as owner"
    );
  }
  // Default time window to 7 days (fairly conservative)
  let riskLimitTimeWindowSecs = 60 * 60 * 24 * 7;
  if (process.env.RISK_LIMIT_TIME_WINDOW_SECS) {
    riskLimitTimeWindowSecs = parseInt(process.env.RISK_LIMIT_TIME_WINDOW_SECS);
  }
  let riskLimitDefaultLimitETH = "0.01";
  if (process.env.RISK_LIMIT_DEFAULT_LIMIT) {
    riskLimitDefaultLimitETH = process.env.RISK_LIMIT_DEFAULT_LIMIT;
  }
  console.log(
    `Risk limits: ${riskLimitTimeWindowSecs} seconds, ${riskLimitDefaultLimitETH} ETH / token`
  );

  const accountParams: AccountInfo = {
    guardianAddresses: allGuardians,
    guardianApprovalThreshold: numSignatures,
    displayName: ownerDisplayName,
    riskLimitTimeWindowSecs,
    riskLimitDefaultLimit: ethers.parseEther(riskLimitDefaultLimitETH),
  };
  console.log("Setting up account with... ", accountParams);

  let result;
  if (process.env.ACCOUNT_FACTORY_ADDRESS) {
    console.log(
      "Using existing account factory at: ",
      process.env.ACCOUNT_FACTORY_ADDRESS
    );
    console.warn(
      `⚠️ \tIf CONTRACTS have changed since the factory was deployed at ${process.env.ACCOUNT_FACTORY_ADDRESS} - these changes will not be deployed unless you deploy a fresh factory.\t ⚠️`
    );
    const deployer = new Deployer(hre, deploymentWallet);
    const accountArtifact = await deployer.loadArtifact("GuardedAccount");
    const factoryArtifact = await deployer.loadArtifact("AccountFactory");

    const factoryContract = new Contract(
      process.env.ACCOUNT_FACTORY_ADDRESS,
      factoryArtifact.abi,
      deploymentWallet
    );
    result = await setupAccountFromFactory(
      deploymentWallet,
      accountParams,
      ownerAddress,
      {
        factoryAddress: process.env.ACCOUNT_FACTORY_ADDRESS,
        factoryContract: factoryContract,
        accountArtifactAbi: accountArtifact.abi,
      }
    );
  } else {
    result = await setupUserAccount(
      deploymentWallet,
      accountParams,
      ownerAddress
    );
  }
  console.log(`

    **Your AccGarda account is ready!**
    **Please make a note of your Smart Account contract address: ${result.accountAddress}**
    
    You can interact with this via https://acc-garda.web.app/?contractAddress=${result.accountAddress}
    `);
}
