import { Contract, Wallet, utils } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
  sendSmartAccountTransaction,
  transferEth,
} from "../../scripts/utils";
import { ethers } from "ethers";
import {
  SmartAccountDetails,
  setupUserAccountForTest,
} from "../../deploy/deploy";
import { makeArbitraryWallet } from "../utils";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const { expect } = chai;

describe("Guarded Account (risk limiting features)", function () {
  let guardian1ContractConnection: Contract;
  let guardian2ContractConnection: Contract;
  let deploymentWallet: Wallet;
  let tokenContract: Contract;
  const guardianWallet1: Wallet = makeArbitraryWallet();
  const guardianWallet2: Wallet = makeArbitraryWallet();
  const proposedOwnerWallet = makeArbitraryWallet();
  const testDisplayName = "The One and Only!";
  const initialDefaultLimit = ethers.parseEther("0.01");
  // Set time window to 1 minute - just check blocking of transactions is active
  const initialTimeWindow = 60;
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
      riskLimitTimeWindowSecs: initialTimeWindow,
      riskLimitDefaultLimit: initialDefaultLimit,
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
    // And give it plenty of ETH
    await transferEth(
      deploymentWallet,
      userAccountDetails.accountAddress,
      "10"
    );
  });

  describe("Spending ETH is limited by the limits", function () {
    it("ETH transactions below that sum to below the limit within the time are allowed", async function () {
      const ownerAddress = userAccountDetails.ownerAddress;
      const ownerBalanceBefore = await deploymentWallet.provider.getBalance(
        ownerAddress
      );
      const withdrawAmount = ethers.parseEther("0.001");

      for (let i = 0; i < 5; i++) {
        await sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: ownerAddress,
            value: withdrawAmount,
          }
        );
      }
      const ownerBalanceAfter = await deploymentWallet.provider.getBalance(
        ownerAddress
      );
      // Since SmartAccount will pay gas for this transaction, it's balance will be below
      // the initial balance - withdrawAmount, but the owner should have the exact amount to check
      expect(ownerBalanceAfter).to.equal(
        ownerBalanceBefore + withdrawAmount * BigInt(5)
      );
    });

    it("An ETH transaction above the limit is blocked", async function () {
      const ownerAddress = userAccountDetails.ownerAddress;
      const withdrawAmount = ethers.parseEther("0.02");
      await expect(
        sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: ownerAddress,
            value: withdrawAmount,
          }
        )
      ).to.be.rejectedWith("Risk limit exceeded");
    });
  });

  describe("Owner can only decrease risk limits", function () {
    it("Owner can decrease the default risk limit", async function () {
      const newLimit = ethers.parseEther("0.0005");
      await sendSmartAccountTransaction(
        userAccountDetails,
        deploymentWallet.provider,
        {
          to: userAccountDetails.accountAddress,
          data: userAccountDetails.contractInterface.encodeFunctionData(
            "decreaseDefaultRiskLimit",
            [newLimit]
          ),
        }
      );
      const theLimit = await guardian1ContractConnection.defaultRiskLimit();
      expect(theLimit).to.equal(newLimit);
    });

    it("Owner cannot increase the risk limits", async function () {
      const newLimit = ethers.parseEther("0.5");
      await expect(
        sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: userAccountDetails.accountAddress,
            data: userAccountDetails.contractInterface.encodeFunctionData(
              "increaseDefaultRiskLimit",
              [newLimit]
            ),
          }
        )
      ).to.be.rejectedWith(
        "GuardedRiskLimits: This action can only be performed via the guardians voting"
      );
    });
  });

  describe("Guardian can vote to increase risk limits", async function () {
    it("Guardian can vote to increase the default risk limit", async function () {
      const newLimit = ethers.parseEther("0.5");
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

      const tx =
        await guardian1ContractConnection.voteForDefaultRiskLimitIncrease(
          newLimit,
          additionalTxParams
        );
      await tx.wait();
      const theLimit = await guardian1ContractConnection.defaultRiskLimit();
      expect(theLimit).to.equal(newLimit);
    });
  });

  describe("When the account is setup without limits", async function () {
    it("Should be possible to spend ETH without any limits", async function () {
      const noLimitsAccount = await setupUserAccountForTest(deploymentWallet, {
        guardianAddresses: constructorInputArray,
        guardianApprovalThreshold: 1,
        displayName: testDisplayName,
        riskLimitTimeWindowSecs: 0,
        riskLimitDefaultLimit: ethers.MaxUint256,
      });
      const ownerAddress = noLimitsAccount.ownerAddress;
      const ownerBalanceBefore = await deploymentWallet.provider.getBalance(
        ownerAddress
      );
      await transferEth(deploymentWallet, noLimitsAccount.accountAddress, "10");
      const withdrawAmount = ethers.parseEther("0.02");

      for (let i = 0; i < 5; i++) {
        await sendSmartAccountTransaction(
          noLimitsAccount,
          deploymentWallet.provider,
          {
            to: ownerAddress,
            value: withdrawAmount,
          }
        );
      }
      const ownerBalanceAfter = await deploymentWallet.provider.getBalance(
        ownerAddress
      );
      // Since SmartAccount will pay gas for this transaction, it's balance will be below
      // the initial balance - withdrawAmount, but the owner should have the exact amount to check
      expect(ownerBalanceAfter).to.equal(
        ownerBalanceBefore + withdrawAmount * BigInt(5)
      );
    });
  });
});
