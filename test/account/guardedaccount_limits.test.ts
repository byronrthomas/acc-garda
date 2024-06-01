import { Contract, Wallet, utils } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
  sendSmartAccountTransaction,
  transferEth,
} from "../../scripts/utils";
import { ethers, getUint } from "ethers";
import {
  SmartAccountDetails,
  setupUserAccountForTest,
  setupUserAccountForTestFromFactory,
} from "../../deploy/deploy";
import {
  makeArbitraryWallet,
  makeTimestampSecsNow,
  sleepUntil,
} from "../utils";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { Deployer } from "@matterlabs/hardhat-zksync";
import * as hre from "hardhat";
import { ETH_ADDRESS } from "zksync-ethers/build/utils";
import {
  deployAccountFactory,
  AccountFactoryDetail,
} from "../../deploy/deployAccountFactory";

chai.use(chaiAsPromised);
const { expect } = chai;

describe("Guarded Account (risk limiting features)", function () {
  let guardian1ContractConnection: Contract;
  let guardian2ContractConnection: Contract;
  let deploymentWallet: Wallet;
  let tokenContract: Contract;
  let riskManager: Contract;
  let guardian1ConnectionToRiskManager: Contract;
  let factoryDetails: AccountFactoryDetail;
  const guardianWallet1: Wallet = makeArbitraryWallet();
  const guardianWallet2: Wallet = makeArbitraryWallet();
  const anotherUserWallet: Wallet = makeArbitraryWallet();
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
    factoryDetails = await deployAccountFactory(deploymentWallet, true);
  });

  beforeEach(async function () {
    userAccountDetails = await setupUserAccountForTestFromFactory(
      deploymentWallet,
      {
        guardianAddresses: constructorInputArray,
        guardianApprovalThreshold: 1,
        displayName: testDisplayName,
        riskLimitTimeWindowSecs: initialTimeWindow,
        riskLimitDefaultLimit: initialDefaultLimit,
      },
      factoryDetails
    );
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
    const riskManagerAddress = await guardian1ContractConnection.riskManager();
    const deployer = new Deployer(hre, deploymentWallet);
    riskManager = new Contract(
      riskManagerAddress,
      (await deployer.loadArtifact("RiskManager")).abi,
      deploymentWallet
    );
    guardian1ConnectionToRiskManager = new Contract(
      riskManagerAddress,
      riskManager.interface,
      guardianWallet1
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

  describe("After deployment", function () {
    it("Should have the correct risk params (via the manager)", async function () {
      const defaultLimit = await riskManager.defaultRiskLimit(
        userAccountDetails.accountAddress
      );
      expect(defaultLimit).to.be.equal(initialDefaultLimit);
      const timeWindow = await riskManager.riskLimitTimeWindow(
        userAccountDetails.accountAddress
      );
      expect(timeWindow).to.be.equal(BigInt(initialTimeWindow));
      const numVotesRequired = await riskManager.numVotesRequired(
        userAccountDetails.accountAddress
      );
      expect(numVotesRequired).to.be.equal(BigInt(1));
    });
    it("Should not allow re-initialisation of risk params (via the manager)", async function () {
      await expect(
        riskManager.initialiseRiskParams(
          userAccountDetails.accountAddress,
          ethers.parseEther("0.02"),
          120,
          1
        )
      ).to.be.rejectedWith(
        "Risk parameters already set - use other methods to adjust them"
      );
    });
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

  describe("Time-delayed transactions", function () {
    it("When the owner allows a time-delayed transaction, a transaction above the limit is allowed only after the time delay", async function () {
      const accountWithShortDelay = await setupUserAccountForTest(
        deploymentWallet,
        {
          guardianAddresses: constructorInputArray,
          guardianApprovalThreshold: 1,
          displayName: testDisplayName,
          riskLimitTimeWindowSecs: 5,
          riskLimitDefaultLimit: ethers.parseEther("0.01"),
        }
      );
      // Ensure the account has enough ETH for what we're doing
      await transferEth(
        deploymentWallet,
        accountWithShortDelay.accountAddress,
        "1"
      );

      const ownerAddress = accountWithShortDelay.ownerAddress;
      const withdrawAmount = ethers.parseEther("0.02");
      const ethTokenAddress =
        await guardian1ContractConnection.ETH_TOKEN_ADDRESS();
      const validFromTime = makeTimestampSecsNow() + 10;
      // Pre-approve the spend
      await sendSmartAccountTransaction(
        accountWithShortDelay,
        deploymentWallet.provider,
        {
          to: accountWithShortDelay.accountAddress,
          data: accountWithShortDelay.contractInterface.encodeFunctionData(
            "allowTimeDelayedTransaction",
            [ethTokenAddress, ethers.parseEther("0.025"), validFromTime]
          ),
        }
      );
      // Spend should still be blocked at this point
      await expect(
        sendSmartAccountTransaction(
          accountWithShortDelay,
          deploymentWallet.provider,
          {
            to: ownerAddress,
            value: withdrawAmount,
          }
        )
      ).to.be.rejectedWith("Risk limit exceeded"); // Ideally would get the message back here, but leave as a TODO for now
      await sleepUntil(Date.now() + 12000); // give a bit of leeway
      // Now the spend should be allowed
      const ownerBalanceBefore = await deploymentWallet.provider.getBalance(
        ownerAddress
      );
      await sendSmartAccountTransaction(
        accountWithShortDelay,
        deploymentWallet.provider,
        {
          to: ownerAddress,
          value: withdrawAmount,
        }
      );
      const ownerBalanceAfter = await deploymentWallet.provider.getBalance(
        ownerAddress
      );
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + withdrawAmount);
    });

    it("When the guardians vote to allow high-value transactions immediately (break-glass), a transaction above the limit is allowed after there are sufficient votes", async function () {
      const ownerAddress = userAccountDetails.ownerAddress;
      const withdrawAmount = ethers.parseEther("0.02");
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
      const ethTokenAddress =
        await guardian1ContractConnection.ETH_TOKEN_ADDRESS();
      const tx = await guardian1ConnectionToRiskManager.voteForSpendAllowance(
        userAccountDetails.accountAddress,
        ethTokenAddress,
        // Set allowance higher to demo that it's the limit that matters
        ethers.parseEther("0.05"),
        additionalTxParams
      );
      await tx.wait();
      // const curentAllowance =
      //   await guardian1ContractConnection.allowanceAvailable(ethTokenAddress);
      // console.log("Current allowance: ", curentAllowance);
      const ownerBalanceBefore = await deploymentWallet.provider.getBalance(
        ownerAddress
      );
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
      expect(ownerBalanceAfter).to.equal(ownerBalanceBefore + withdrawAmount);
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
      const theLimit = await guardian1ConnectionToRiskManager.defaultRiskLimit(
        userAccountDetails.accountAddress
      );
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
        "RiskManager: This action can only be performed via the guardians voting"
      );
    });

    it("A.N. Other cannot immediately decrease/increase the risk limits by calling account", async function () {
      // Ensure the user can pay their fees
      const arbitraryUser = makeArbitraryWallet();
      const userConnection = new Contract(
        userAccountDetails.accountAddress,
        userAccountDetails.contractInterface,
        arbitraryUser
      );

      await transferEth(deploymentWallet, arbitraryUser.address, "0.02");
      const newLimit = ethers.parseEther("0.0005");
      // TODO: should come back in a signature failure I think
      await expect(
        userConnection.decreaseDefaultRiskLimit(newLimit)
      ).to.be.rejectedWith(
        "This function can only be called as a smart account transaction"
      );
      await expect(
        userConnection.decreaseSpecificRiskLimit(ETH_ADDRESS, newLimit)
      ).to.be.rejectedWith(
        "This function can only be called as a smart account transaction"
      );
      await expect(
        userConnection.increaseDefaultRiskLimit(newLimit)
      ).to.be.rejectedWith(
        "This function can only be called as a smart account transaction"
      );
      await expect(
        userConnection.increaseSpecificRiskLimit(ETH_ADDRESS, newLimit)
      ).to.be.rejectedWith(
        "This function can only be called as a smart account transaction"
      );
      await expect(
        userConnection.decreaseRiskLimitTimeWindow(10)
      ).to.be.rejectedWith(
        "This function can only be called as a smart account transaction"
      );
      await expect(
        userConnection.increaseRiskLimitTimeWindow(10)
      ).to.be.rejectedWith(
        "This function can only be called as a smart account transaction"
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
        await guardian1ConnectionToRiskManager.voteForDefaultRiskLimitIncrease(
          userAccountDetails.accountAddress,
          newLimit,
          additionalTxParams
        );
      await tx.wait();
      const theLimit = await guardian1ConnectionToRiskManager.defaultRiskLimit(
        userAccountDetails.accountAddress
      );
      expect(theLimit).to.equal(newLimit);
    });
  });

  describe("ERC-20 token transactions are also correctly limited", function () {
    beforeEach(async function () {
      // Ensure the account has enough tokens for what we're doing
      const erc20tx = await tokenContract.transfer(
        userAccountDetails.accountAddress,
        ethers.parseEther("10")
      );
      await erc20tx.wait();
    });

    describe("ECR-20 transactions below the limit are allowed", async function () {
      it("transfer method below limit is allowed", async function () {
        const tokenAmount = ethers.parseEther("0.01");
        const tokenAddress = await tokenContract.getAddress();

        await sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: tokenAddress,
            data: tokenContract.interface.encodeFunctionData("transfer", [
              anotherUserWallet.address,
              // This should be equal to the default limit
              tokenAmount,
            ]),
          }
        );
        const recepientBalanceAfter = await tokenContract.balanceOf(
          anotherUserWallet.address
        );
        expect(recepientBalanceAfter).to.equal(tokenAmount);
      });

      it("approve method below limit is allowed", async function () {
        const tokenAmount = ethers.parseEther("0.01");
        const tokenAddress = await tokenContract.getAddress();
        const spenderAddress = anotherUserWallet.address;
        const spenderAllowanceBefore = await tokenContract.allowance(
          userAccountDetails.accountAddress,
          spenderAddress
        );

        await sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: tokenAddress,
            data: tokenContract.interface.encodeFunctionData("approve", [
              spenderAddress,
              // This should be equal to the default limit
              tokenAmount,
            ]),
          }
        );
        const spenderAllowanceAfter = await tokenContract.allowance(
          userAccountDetails.accountAddress,
          spenderAddress
        );
        expect(spenderAllowanceAfter).to.equal(
          tokenAmount + spenderAllowanceBefore
        );
      });

      it("burn method below limit is allowed", async function () {
        const tokenAmount = ethers.parseEther("0.01");
        const tokenAddress = await tokenContract.getAddress();
        const balanceBefore = await tokenContract.balanceOf(
          userAccountDetails.accountAddress
        );

        await sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: tokenAddress,
            data: tokenContract.interface.encodeFunctionData("burn", [
              // This should be equal to the default limit
              tokenAmount,
            ]),
          }
        );
        const balanceAfter = await tokenContract.balanceOf(
          userAccountDetails.accountAddress
        );
        expect(balanceAfter).to.equal(balanceBefore - tokenAmount);
      });
    });

    describe("ECR-20 transactions above the limit are blocked", async function () {
      const tokenAmount = ethers.parseEther("0.0011");
      beforeEach(async function () {
        // Set a different limit for our token - just to demo that the limits
        // are address specific
        const tokenAddress = await tokenContract.getAddress();
        const newLimit = ethers.parseEther("0.001");
        // Reduce the limit - this means that the owner can action it immediately
        // without votes
        await sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: userAccountDetails.accountAddress,
            data: userAccountDetails.contractInterface.encodeFunctionData(
              "decreaseSpecificRiskLimit",
              [tokenAddress, newLimit]
            ),
          }
        );
      });

      it("transfer method above the limit is blocked", async function () {
        const tokenAddress = await tokenContract.getAddress();

        await expect(
          sendSmartAccountTransaction(
            userAccountDetails,
            deploymentWallet.provider,
            {
              to: tokenAddress,
              data: tokenContract.interface.encodeFunctionData("transfer", [
                anotherUserWallet.address,
                // This should be equal to the default limit
                tokenAmount,
              ]),
            }
          )
        ).to.be.rejectedWith("Risk limit exceeded");
      });

      it("approve method above limit is blocked", async function () {
        const tokenAddress = await tokenContract.getAddress();
        const spenderAddress = anotherUserWallet.address;
        await expect(
          sendSmartAccountTransaction(
            userAccountDetails,
            deploymentWallet.provider,
            {
              to: tokenAddress,
              data: tokenContract.interface.encodeFunctionData("approve", [
                spenderAddress,
                // This should be equal to the default limit
                tokenAmount,
              ]),
            }
          )
        ).to.be.rejectedWith("Risk limit exceeded");
      });

      it("increaseAllowance method above limit is blocked", async function () {
        const tokenAddress = await tokenContract.getAddress();
        await expect(
          sendSmartAccountTransaction(
            userAccountDetails,
            deploymentWallet.provider,
            {
              to: tokenAddress,
              data: tokenContract.interface.encodeFunctionData(
                "increaseAllowance",
                [anotherUserWallet.address, ethers.parseEther("0.002")]
              ),
            }
          )
        ).to.be.rejectedWith("Risk limit exceeded");
      });

      it("burn method above limit is blocked", async function () {
        const tokenAddress = await tokenContract.getAddress();

        await expect(
          sendSmartAccountTransaction(
            userAccountDetails,
            deploymentWallet.provider,
            {
              to: tokenAddress,
              data: tokenContract.interface.encodeFunctionData("burn", [
                // This should be equal to the default limit
                tokenAmount,
              ]),
            }
          )
        ).to.be.rejectedWith("Risk limit exceeded");
      });

      it("sequence of smaller transactions that sum to above the limit are blocked", async function () {
        const tokenAddress = await tokenContract.getAddress();

        // Should be allowed
        await sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: tokenAddress,
            data: tokenContract.interface.encodeFunctionData("transfer", [
              anotherUserWallet.address,
              ethers.parseEther("0.0004"),
            ]),
          }
        );
        // Should be allowed
        await sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: tokenAddress,
            data: tokenContract.interface.encodeFunctionData("approve", [
              anotherUserWallet.address,
              ethers.parseEther("0.0001"),
            ]),
          }
        );
        // Should be allowed
        await sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: tokenAddress,
            data: tokenContract.interface.encodeFunctionData(
              "increaseAllowance",
              [anotherUserWallet.address, ethers.parseEther("0.0002")]
            ),
          }
        );
        // Should be allowed
        await sendSmartAccountTransaction(
          userAccountDetails,
          deploymentWallet.provider,
          {
            to: tokenAddress,
            data: tokenContract.interface.encodeFunctionData("burn", [
              ethers.parseEther("0.0002"),
            ]),
          }
        );

        // Now we'll be blocked if we attempt more than 0.0001
        await expect(
          sendSmartAccountTransaction(
            userAccountDetails,
            deploymentWallet.provider,
            {
              to: tokenAddress,
              data: tokenContract.interface.encodeFunctionData("transfer", [
                anotherUserWallet.address,
                ethers.parseEther("0.00011"),
              ]),
            }
          )
        ).to.be.rejectedWith("Risk limit exceeded");
      });
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

    it("Should be possible to transfer ERC-20 tokens without any limits", async function () {
      const noLimitsAccount = await setupUserAccountForTest(deploymentWallet, {
        guardianAddresses: constructorInputArray,
        guardianApprovalThreshold: 1,
        displayName: testDisplayName,
        riskLimitTimeWindowSecs: 0,
        riskLimitDefaultLimit: ethers.MaxUint256,
      });
      const tokenAddress = await tokenContract.getAddress();
      const tokenAmount = ethers.parseEther("10");

      const tx = await tokenContract.transfer(
        noLimitsAccount.accountAddress,
        ethers.parseEther("100")
      );
      await tx.wait();
      const recipientBalanceBefore = await tokenContract.balanceOf(
        anotherUserWallet.address
      );
      await sendSmartAccountTransaction(
        noLimitsAccount,
        deploymentWallet.provider,
        {
          to: tokenAddress,
          data: tokenContract.interface.encodeFunctionData("transfer", [
            anotherUserWallet.address,
            tokenAmount,
          ]),
        }
      );
      const recepientBalanceAfter = await tokenContract.balanceOf(
        anotherUserWallet.address
      );
      expect(recepientBalanceAfter).to.equal(
        tokenAmount + recipientBalanceBefore
      );

      const accountBalanceBefore = await tokenContract.balanceOf(
        noLimitsAccount.accountAddress
      );
      await sendSmartAccountTransaction(
        noLimitsAccount,
        deploymentWallet.provider,
        {
          to: tokenAddress,
          data: tokenContract.interface.encodeFunctionData("burn", [
            tokenAmount,
          ]),
        }
      );
      const accountBalanceAfter = await tokenContract.balanceOf(
        noLimitsAccount.accountAddress
      );
      expect(accountBalanceAfter).to.equal(accountBalanceBefore - tokenAmount);

      const spenderAllowanceBefore = await tokenContract.allowance(
        noLimitsAccount.accountAddress,
        anotherUserWallet.address
      );
      await sendSmartAccountTransaction(
        noLimitsAccount,
        deploymentWallet.provider,
        {
          to: tokenAddress,
          data: tokenContract.interface.encodeFunctionData("approve", [
            anotherUserWallet.address,
            tokenAmount,
          ]),
        }
      );
      const spenderAllowanceAfter = await tokenContract.allowance(
        noLimitsAccount.accountAddress,
        anotherUserWallet.address
      );
      expect(spenderAllowanceAfter).to.equal(
        tokenAmount + spenderAllowanceBefore
      );
    });
  });
});
