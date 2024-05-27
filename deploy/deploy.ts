import * as ethers from "ethers";
import {
  LOCAL_RICH_WALLETS,
  deployContract,
  getWallet,
} from "../scripts/utils";
import hre from "hardhat";
import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { Contract, Wallet, utils } from "zksync-ethers";
import { transferEth } from "../scripts/utils";

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
};

export async function setupUserAccount(
  wallet: Wallet,
  info: AccountInfo,
  ownerAddress: string
) {
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

  const salt = ethers.randomBytes(32);
  const tx = await factoryContract.deployAccount(
    salt,
    ownerAddress,
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
        ownerAddress,
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
    ownerAddress: ownerAddress,
    contractInterface: accountContract.interface,
  };
}

export async function setupUserAccountForTest(
  wallet: Wallet,
  info: AccountInfo
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

// NOTE - down the line, almost certainly want to specify the owner address, rather than have it auto-generated
export default async function () {
  //console.log("Private key:", process.env.WALLET_PRIVATE_KEY);
  // TO use LOCAL_RICH_WALLETS[0].privateKey), add WALLET_PRIVATE_KEY="0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110" to the start of your command
  const deploymentWallet = getWallet();
  const blockNum = await deploymentWallet.provider.getBlockNumber();
  console.log(`Current block number: ${blockNum}`);
  // const extraGuardian = process.env.EXTRA_GUARDIAN;
  // const allGuardians = [LOCAL_RICH_WALLETS[9].address];
  // if (extraGuardian) {
  //   console.log("Extra guardian: ", extraGuardian);
  //   allGuardians.push(extraGuardian);
  // }
  await setupUserAccount(
    deploymentWallet,
    {
      guardianAddresses: [],
      guardianApprovalThreshold: 1,
      displayName: "Test Account",
    },
    // TODO: make owner address configurable when calling script
    deploymentWallet.address
  );

  // const blockInfo = await deploymentWallet.provider.getBlockDetails(blockNum);
  // console.log(`Block details: ${x}`);
}
