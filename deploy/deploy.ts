// import { Deployer } from "@matterlabs/hardhat-zksync";
import * as ethers from "ethers";
import { LOCAL_RICH_WALLETS, deployContract, getWallet } from "./utils";
import hre from "hardhat";
import { Deployer } from '@matterlabs/hardhat-zksync-deploy';
import { Contract, Wallet, utils } from "zksync-ethers";
import { toJSON } from "zksync-ethers/build/utils";

async function setupUserAccount(wallet: Wallet) {
  // Credit: the initial implementation of this takes heavy pointers from the example code in the ZKSync docs:
  // https://docs.zksync.io/build/tutorials/smart-contract-development/account-abstraction/daily-spend-limit.html
  const deployer = new Deployer(hre, wallet);
  const accountArtifact = await deployer.loadArtifact("GuardedAccount");
  const factoryContract = await deployContract("AccountFactory", [utils.hashBytecode(accountArtifact.bytecode)], {wallet: wallet, additionalFactoryDeps: [accountArtifact.bytecode]});
  const factoryAddress = await factoryContract.getAddress()
  console.log(`AA factory address: ${factoryAddress}`);
  

  const owner = Wallet.createRandom();
  console.log("SC Account owner pk: ", owner.privateKey);

  const salt = ethers.randomBytes(32);
  const tx = await factoryContract.deployAccount(salt, owner.address);
  await tx.wait();

  const abiCoder = new ethers.AbiCoder();
  const accountAddress = utils.create2Address(factoryAddress, await factoryContract.accountBytecodeHash(), salt, abiCoder.encode(["address"], [owner.address]));

  console.log(`SC Account deployed on address ${accountAddress}`);
  console.log("Funding smart contract account with some ETH");
  await (
    await wallet.sendTransaction({
      to: accountAddress,
      value: ethers.parseEther("0.02"),
    })
  ).wait();
  console.log(`Done!`);
}

export default async function() {
  const ownerWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
  await setupUserAccount(ownerWallet);
}