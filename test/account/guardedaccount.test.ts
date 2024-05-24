import { expect } from "chai";
import { Contract, Wallet } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
  sendSmartAccountTransaction,
} from "../../deploy/utils";
import { ethers } from "ethers";
import deploy, {
  SmartAccountDetails,
  setupUserAccount,
  transferEth,
} from "../../deploy/deploy";
import { transferTokenFromUserAccount } from "../erc20/myerc20token.test";

function makeArbitraryWallet(): Wallet {
  return getWallet(Wallet.createRandom().privateKey);
}

describe("Guarded Account (guarded ownership features)", function () {
  let guardian1ContractConnection: Contract;
  let guardian2ContractConnection: Contract;
  let deploymentWallet: Wallet;
  let tokenContract: Contract;
  const guardianWallet1: Wallet = makeArbitraryWallet();
  const guardianWallet2: Wallet = makeArbitraryWallet();
  const proposedOwnerWallet = makeArbitraryWallet();
  const testDisplayName = "The One and Only!";
  // Add some duplicates just to be sure
  const constructorInputArray = [
    guardianWallet1.address,
    guardianWallet2.address,
  ];
  let userAccountDetails: SmartAccountDetails;

  before(async function () {
    deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    // Ensure all the guardians can pay their own fees
    // const balance = await deploymentWallet.provider.getBalance(
    //   deploymentWallet.address
    // );
    // console.log(`Deployment wallet balance: ${balance}`);
    await transferEth(deploymentWallet, guardianWallet1.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet2.address, "0.02");
    tokenContract = await deployContract("MyERC20Token", [], {
      wallet: deploymentWallet,
      silent: true,
    });
  });

  beforeEach(async function () {
    userAccountDetails = await setupUserAccount(deploymentWallet, {
      guardianAddresses: constructorInputArray,
      guardianApprovalThreshold: 1,
      displayName: testDisplayName,
    });
    guardian1ContractConnection = new Contract(
      userAccountDetails.accountAddress,
      userAccountDetails.contractInterface,
      guardianWallet1
    );
    guardian2ContractConnection = new Contract(
      userAccountDetails.accountAddress,
      userAccountDetails.contractInterface,
      guardianWallet2
    );
    // Ensure the guarded account initially owns some ERC-20 tokens
    const initialTx = await tokenContract.transfer(
      userAccountDetails.accountAddress,
      ethers.parseEther("10")
    );
    await initialTx.wait();
  });

  describe("Before ownership changes", function () {
    it("Should have the correct owner address", async function () {
      const ownerAddress = await guardian1ContractConnection.owner();
      // the owner address should be the corresponding address for userAccountDetails.ownerPrivateKey
      const expectedOwnerAddress = ethers.computeAddress(
        userAccountDetails.ownerPrivateKey
      );
      expect(ownerAddress).to.equal(expectedOwnerAddress);
    });

    it("Ownership of an ERC20 token should be controlled by original owner", async function () {
      await transferTokenFromUserAccount(
        tokenContract,
        deploymentWallet.provider,
        userAccountDetails,
        deploymentWallet.address,
        ethers.parseEther("10")
      );

      const userBalanceAfter = await tokenContract.balanceOf(
        userAccountDetails.accountAddress
      );
      expect(userBalanceAfter).to.equal(ethers.toBigInt(0));
    });

    it("Owner should be able to withdraw ETH from the smart account", async function () {
      const ownerAddress = userAccountDetails.ownerAddress;
      const ownerBalanceBefore = await deploymentWallet.provider.getBalance(
        ownerAddress
      );
      const withdrawAmount = ethers.parseEther("0.01");

      await sendSmartAccountTransaction(
        userAccountDetails,
        deploymentWallet.provider,
        {
          to: ownerAddress,
          value: withdrawAmount,
        }
      );
      const ownerBalanceAfter = await deploymentWallet.provider.getBalance(
        ownerAddress
      );
      // Since SmartAccount will pay gas for this transaction, it's balance will be below
      // the initial balance - withdrawAmount, but the owner should have the exact amount to check
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + withdrawAmount);
    });
  });

  describe("After ownership changes", function () {
    let newUserAccountDetails: SmartAccountDetails;

    // NOTE: need to do beforeEach on this, as user account (and guardian connections
    // to the smart account) will change every test due to the beforeEach in outer scope
    beforeEach(async function () {
      console.log(
        "Proposing new owner via guardian1, contract address: ",
        await guardian1ContractConnection.getAddress()
      );
      const tx = await guardian1ContractConnection.voteForNewOwner(
        proposedOwnerWallet.address
      );
      await tx.wait();

      newUserAccountDetails = {
        accountAddress: userAccountDetails.accountAddress,
        contractInterface: userAccountDetails.contractInterface,
        ownerPrivateKey: proposedOwnerWallet.privateKey,
        ownerAddress: proposedOwnerWallet.address,
      };
    });

    it("Should have the correct new owner address", async function () {
      const newOwner = await guardian1ContractConnection.owner();
      expect(newOwner).to.equal(proposedOwnerWallet.address);
    });

    it("Ownership of an ERC20 token should be controlled by proposed owner", async function () {
      await transferTokenFromUserAccount(
        tokenContract,
        deploymentWallet.provider,
        newUserAccountDetails,
        deploymentWallet.address,
        ethers.parseEther("10")
      );

      const userBalanceAfter = await tokenContract.balanceOf(
        userAccountDetails.accountAddress
      );
      // Double-check well-setup test - the account address hasn't changed (the smart account is the same)
      expect(userAccountDetails.accountAddress).to.equal(
        newUserAccountDetails.accountAddress
      );
      expect(userBalanceAfter).to.equal(ethers.parseEther("0"));
    });
  });
});
