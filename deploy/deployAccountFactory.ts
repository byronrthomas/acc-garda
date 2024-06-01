import * as ethers from "ethers";
import { deployContract, getWallet } from "../scripts/utils";
import hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Contract, Wallet, utils } from "zksync-ethers";

export type AccountFactoryDetail = {
  accountArtifactAbi: ethers.InterfaceAbi;
  factoryContract: Contract;
  factoryAddress: string;
};
export async function deployAccountFactory(
  wallet: Wallet,
  silentDeploy: boolean | undefined
): Promise<AccountFactoryDetail> {
  const deployer = new Deployer(hre, wallet);
  const guardianRegistry = await deployContract("GuardianRegistry", [], {
    wallet: wallet,
    silent: silentDeploy ?? true,
  });
  const guardianRegistryAddress = await guardianRegistry.getAddress();
  console.log(`Guardian registry address: ${guardianRegistryAddress}`);

  const ownershipRegistry = await deployContract(
    "OwnershipRegistry",
    [guardianRegistryAddress],
    {
      wallet: wallet,
      silent: silentDeploy ?? true,
    }
  );
  const ownershipRegistryAddress = await ownershipRegistry.getAddress();
  console.log(`Ownership registry address: ${ownershipRegistryAddress}`);

  const riskManager = await deployContract(
    "RiskManager",
    [guardianRegistryAddress],
    {
      wallet: wallet,
      silent: silentDeploy ?? true,
    }
  );
  const riskManagerAddress = await riskManager.getAddress();
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
  const deploymentWallet = getWallet();
  await deployAccountFactory(deploymentWallet, false);
}
