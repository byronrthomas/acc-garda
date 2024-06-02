import * as ethers from "ethers";
import { deployContract, getWallet } from "../scripts/utils";
import hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Contract, Wallet, utils } from "zksync-ethers";
import { sleepUntil } from "../test/utils";

export type AccountFactoryDetail = {
  accountArtifactAbi: ethers.InterfaceAbi;
  factoryContract: Contract;
  factoryAddress: string;
};
export type PreDeployedAddresses = {
  guardianRegistry: string;
  ownershipRegistry: string;
  riskManager: string;
};

export async function deployAccountFactory(
  wallet: Wallet,
  silentDeploy: boolean | undefined,
  predeployed?: PreDeployedAddresses,
  skipWaiting?: boolean
): Promise<AccountFactoryDetail> {
  const waitingForDeploy = skipWaiting ?? false;
  const pause = async () => {
    if (waitingForDeploy) {
      console.log("Waiting between deployments");
      await sleepUntil(Date.now() + 10000);
    }
  };

  const deployer = new Deployer(hre, wallet);
  let guardianRegistryAddress: string;
  if (predeployed?.guardianRegistry) {
    console.log(
      `Using existing guardian registry: ${predeployed.guardianRegistry}`
    );
    guardianRegistryAddress = predeployed.guardianRegistry;
  } else {
    const guardianRegistry = await deployContract("GuardianRegistry", [], {
      wallet: wallet,
      silent: silentDeploy ?? true,
    });
    guardianRegistryAddress = await guardianRegistry.getAddress();
    await pause();
  }
  console.log(`Guardian registry address: ${guardianRegistryAddress}`);

  let ownershipRegistryAddress: string;
  if (predeployed?.ownershipRegistry) {
    console.log(
      `Using existing ownership registry: ${predeployed.ownershipRegistry}`
    );
    ownershipRegistryAddress = predeployed.ownershipRegistry;
  } else {
    const ownershipRegistry = await deployContract(
      "OwnershipRegistry",
      [guardianRegistryAddress],
      {
        wallet: wallet,
        silent: silentDeploy ?? true,
      }
    );
    ownershipRegistryAddress = await ownershipRegistry.getAddress();
    await pause();
  }
  console.log(`Ownership registry address: ${ownershipRegistryAddress}`);

  let riskManagerAddress: string;
  if (predeployed?.riskManager) {
    console.log(`Using existing risk manager: ${predeployed.riskManager}`);
    riskManagerAddress = predeployed.riskManager;
  } else {
    const riskManager = await deployContract(
      "RiskManager",
      [guardianRegistryAddress],
      {
        wallet: wallet,
        silent: silentDeploy ?? true,
      }
    );
    riskManagerAddress = await riskManager.getAddress();
    await pause();
  }
  console.log(`Risk manager address: ${riskManagerAddress}`);

  const accountArtifact = await deployer.loadArtifact("GuardedAccount");
  const factoryContract = await deployContract(
    "AccountFactory",
    [
      utils.hashBytecode(accountArtifact.bytecode),
      guardianRegistryAddress,
      ownershipRegistryAddress,
      riskManagerAddress,
    ],
    {
      wallet: wallet,
      additionalFactoryDeps: [accountArtifact.bytecode],
      silent: silentDeploy ?? true,
    }
  );
  const factoryAddress = await factoryContract.getAddress();
  return {
    factoryAddress,
    factoryContract,
    accountArtifactAbi: accountArtifact.abi,
  };
}

export async function deployGuardianRegistry(
  wallet: Wallet,
  silentDeploy: boolean | undefined
) {
  return await deployContract("GuardianRegistry", [], {
    wallet: wallet,
    silent: silentDeploy ?? true,
  });
}

export default async function () {
  // TO use LOCAL_RICH_WALLETS[0].privateKey), add WALLET_PRIVATE_KEY="0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110" to the start of your command
  const guardianRegistryAddress = process.env.GUARDIAN_REGISTRY || "";
  const ownershipRegistryAddress = process.env.OWNERSHIP_REGISTRY || "";
  const riskManagerAddress = process.env.RISK_MANAGER || "";
  const deploymentWallet = getWallet();
  const details = await deployAccountFactory(
    deploymentWallet,
    false, // verbose deploy
    {
      guardianRegistry: guardianRegistryAddress,
      ownershipRegistry: ownershipRegistryAddress,
      riskManager: riskManagerAddress,
    },
    false // Don't pause during deployments
  );
  console.log(`\n Account factory deployed at: ${details.factoryAddress}\n\n`);
}
