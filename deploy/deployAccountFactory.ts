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
) {
  const deployer = new Deployer(hre, wallet);
  const accountArtifact = await deployer.loadArtifact("GuardedAccount");
  const factoryContract = await deployContract(
    "AccountFactory",
    [utils.hashBytecode(accountArtifact.bytecode)],
    {
      wallet: wallet,
      additionalFactoryDeps: [accountArtifact.bytecode],
      silent: silentDeploy ?? true,
    }
  );
  const factoryAddress = await factoryContract.getAddress();
  return { factoryAddress, factoryContract, accountArtifact };
}

export default async function () {
  // TO use LOCAL_RICH_WALLETS[0].privateKey), add WALLET_PRIVATE_KEY="0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110" to the start of your command
  const deploymentWallet = getWallet();
  await deployAccountFactory(deploymentWallet, false);
}
