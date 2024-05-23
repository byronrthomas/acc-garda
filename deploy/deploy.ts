import * as ethers from "ethers";
import { LOCAL_RICH_WALLETS, deployContract, getWallet } from "./utils";
import hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Contract, Wallet, utils } from "zksync-ethers";

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
   * Interface of the smart account contract
   */
  contractInterface: ethers.Interface;
};

export type AccountInfo = {
  guardianAddresses: string[];
  guardianApprovalThreshold: number;
  displayName: string;
};

export async function setupUserAccount(
  wallet: Wallet,
  info: AccountInfo
): Promise<SmartAccountDetails> {
  // Credit: the initial implementation of this takes heavy pointers from the example code in the ZKSync docs:
  // https://docs.zksync.io/build/tutorials/smart-contract-development/account-abstraction/daily-spend-limit.html
  const deployer = new Deployer(hre, wallet);
  const accountArtifact = await deployer.loadArtifact("GuardedAccount");
  const factoryContract = await deployContract(
    "AccountFactory",
    [utils.hashBytecode(accountArtifact.bytecode)],
    { wallet: wallet, additionalFactoryDeps: [accountArtifact.bytecode] }
  );
  const factoryAddress = await factoryContract.getAddress();
  console.log(`AA factory address: ${factoryAddress}`);

  const owner = Wallet.createRandom();
  console.log("SC Account owner pk: ", owner.privateKey);
  console.log("SC Account owner address: ", owner.address);

  const salt = ethers.randomBytes(32);
  const tx = await factoryContract.deployAccount(
    salt,
    owner.address,
    info.guardianAddresses,
    info.guardianApprovalThreshold,
    info.displayName
  );
  await tx.wait();

  const abiCoder = new ethers.AbiCoder();
  const accountAddress = utils.create2Address(
    factoryAddress,
    await factoryContract.accountBytecodeHash(),
    salt,
    abiCoder.encode(
      ["address", "address[]", "uint", "string"],
      [
        owner.address,
        info.guardianAddresses,
        info.guardianApprovalThreshold,
        info.displayName,
      ]
    )
  );
  const accountContract = new Contract(
    accountAddress,
    accountArtifact.abi,
    wallet
  );

  console.log(`SC Account deployed on address ${accountAddress}`);
  const accountInfo = await wallet.provider.getContractAccountInfo(
    accountAddress
  );
  console.log("Account Info: ", accountInfo);
  console.log("Funding smart contract account with some ETH");
  await transferEth(wallet, accountAddress, "0.02");
  console.log(`Done!`);
  return {
    accountAddress,
    ownerPrivateKey: owner.privateKey,
    contractInterface: accountContract.interface,
  };
}

export async function transferEth(wallet: Wallet, to: string, amount: string) {
  // console.log(`Transferring ${amount} ETH to ${to}`);
  const tx = await wallet.sendTransaction({
    to,
    value: ethers.parseEther(amount),
  });
  await tx.wait();
}

export default async function () {
  const deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
  await setupUserAccount(deploymentWallet, {
    guardianAddresses: [LOCAL_RICH_WALLETS[9].address],
    guardianApprovalThreshold: 1,
    displayName: "Test Account",
  });
}
