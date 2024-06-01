import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const { expect } = chai;
import { Contract, Wallet, utils } from "zksync-ethers";
import * as hre from "hardhat";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
  sendSmartAccountTransaction,
} from "../../scripts/utils";
import { ethers } from "ethers";
import {
  SmartAccountDetails,
  setupUserAccountForTest,
} from "../../deploy/deploy";
import { transferTokenFromUserAccount } from "../erc20/myerc20token.test";
import { makeArbitraryWallet } from "../utils";
import { Deployer } from "@matterlabs/hardhat-zksync";

describe("Guarded Account (guarded ownership features)", function () {
  let guardian1AccountConnection: Contract;
  let guardian2ContractConnection: Contract;
  let deploymentWallet: Wallet;
  let tokenContract: Contract;
  let guardianRegistry: Contract;
  let ownershipRegistry: Contract;
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
    // await transferEth(deploymentWallet, guardianWallet1.address, "0.02");
    // await transferEth(deploymentWallet, guardianWallet2.address, "0.02");
    tokenContract = await deployContract("MyERC20Token", [], {
      wallet: deploymentWallet,
      silent: true,
    });
  });

  beforeEach(async function () {
    userAccountDetails = await setupUserAccountForTest(deploymentWallet, {
      guardianAddresses: constructorInputArray,
      guardianApprovalThreshold: 1,
      displayName: testDisplayName,
      // Set limits to be essentially disabled for this test
      riskLimitTimeWindowSecs: 0,
      riskLimitDefaultLimit: ethers.MaxUint256,
    });
    guardian1AccountConnection = new Contract(
      userAccountDetails.accountAddress,
      userAccountDetails.contractInterface,
      guardianWallet1
    );
    guardian2ContractConnection = new Contract(
      userAccountDetails.accountAddress,
      userAccountDetails.contractInterface,
      guardianWallet2
    );
    const guardianRegistryAddress =
      await guardian1AccountConnection.guardianRegistry();
    const ownershipRegistryAddress =
      await guardian1AccountConnection.ownershipRegistry();
    const deployer = new Deployer(hre, deploymentWallet);
    guardianRegistry = new Contract(
      guardianRegistryAddress,
      (await deployer.loadArtifact("GuardianRegistry")).abi,
      deploymentWallet
    );
    ownershipRegistry = new Contract(
      ownershipRegistryAddress,
      (await deployer.loadArtifact("OwnershipRegistry")).abi,
      deploymentWallet
    );

    // Ensure the guarded account initially owns some ERC-20 tokens
    const initialTx = await tokenContract.transfer(
      userAccountDetails.accountAddress,
      ethers.parseEther("10")
    );
    await initialTx.wait();
  });

  describe("After deployment", function () {
    it("Should have the correct guardian addresses (via the registry)", async function () {
      const guardians = await guardianRegistry.getGuardiansFor(
        userAccountDetails.accountAddress
      );
      expect([...guardians]).to.have.members([...constructorInputArray]);
    });
    it("Should have the correct owner (via the registry)", async function () {
      const ownerAddress = await ownershipRegistry.accountOwner(
        userAccountDetails.accountAddress
      );
      expect(ownerAddress).to.equal(userAccountDetails.ownerAddress);
    });
    it("Should not allow a change of the guardian addresses (via the registry)", async function () {
      const newGuardians = [makeArbitraryWallet().address];
      await expect(
        guardianRegistry.setGuardiansFor(
          userAccountDetails.accountAddress,
          newGuardians
        )
      ).to.be.rejectedWith(
        "Only the guarded address can change it's guardians"
      );
    });
    it("Should not allow a change of the owner (via the registry)", async function () {
      const newOwner = makeArbitraryWallet().address;
      await expect(
        ownershipRegistry.setInitialOwner(
          userAccountDetails.accountAddress,
          newOwner,
          constructorInputArray.length,
          "Some other dude"
        )
      ).to.be.rejectedWith(
        "Owner already set for account - needs guardian voting to change it"
      );
      // Ownership reg is connected via deployment wallet
      await expect(
        ownershipRegistry.voteForNewOwner(
          userAccountDetails.accountAddress,
          newOwner
        )
      ).to.be.rejectedWith("Only guardian can call this method");
    });
  });

  describe("Before ownership changes", function () {
    it("Should have the correct owner address", async function () {
      const ownerAddress = await guardian1AccountConnection.owner();
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
        await guardian1AccountConnection.getAddress()
      );
      const gasPrice = await deploymentWallet.provider.getGasPrice();
      // Ask the smart account to pay for the fees to vote
      const paymasterParams = utils.getPaymasterParams(
        userAccountDetails.accountAddress,
        {
          type: "General",
          innerInput: new Uint8Array(),
        }
      );
      const additionalTxParams = {
        maxPriorityFeePerGas: BigInt(0),
        maxFeePerGas: gasPrice,
        gasLimit: 6000000,
        customData: {
          gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
          paymasterParams,
        },
      };

      const guardianToRegistryConnection = new Contract(
        await ownershipRegistry.getAddress(),
        ownershipRegistry.interface,
        guardianWallet1
      );
      const tx = await guardianToRegistryConnection.voteForNewOwner(
        userAccountDetails.accountAddress,
        proposedOwnerWallet.address,
        additionalTxParams
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
      const newOwner = await guardian1AccountConnection.owner();
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
