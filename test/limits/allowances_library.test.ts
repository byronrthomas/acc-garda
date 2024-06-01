import { Contract, Provider, Wallet, utils } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
  transferEth,
} from "../../scripts/utils";
import {
  makeArbitraryWallet,
  makeTimestampSecs,
  serializeBigInt,
  sleepUntil,
} from "../utils";
import { ethers } from "ethers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const { expect } = chai;

const NO_LIMIT = ethers.MaxUint256;
const TOKEN_ADDRESS_1 = ethers.hexlify(ethers.randomBytes(20));
const TOKEN_ADDRESS_2 = ethers.hexlify(ethers.randomBytes(20));
const ETHER_TOKEN = ethers.ZeroAddress;

async function fetchLatestTimestamp(provider: Provider) {
  const blockNum = await provider.getBlockNumber();
  // console.log("Current block number: ", blockNum);
  const blockDetails = await provider.getBlockDetails(blockNum);
  // console.log("Current block details: ", blockDetails);
  return blockDetails.timestamp;
}

const ALREADY_PAST = makeTimestampSecs(new Date(2021, 0, 1, 0, 0, 0));
const DEFINITELY_FUTURE = makeTimestampSecs(new Date(2030, 0, 1, 0, 0, 0));

describe("Allowances library test (via TestRiskLimited contract)", function () {
  const deploymentWallet: Wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
  let testContract: Contract;
  const senderAddress: string = deploymentWallet.address;

  describe("Allowances management - basic add/cancel and timings", async function () {
    beforeEach(async function () {
      deploymentWallet;
      testContract = await deployContract(
        "TestRiskLimited",
        // Let's set a limit of zero for this so that the spends don't interfere with the approvals
        [1000, "0x00"],
        { wallet: deploymentWallet, silent: true }
      );
    });

    it("Should handle tokens independently of each other", async function () {
      const approvalAmount = ethers.parseEther("10");
      let tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      let approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_2
      );
      expect(approvedAllowance).to.be.equal(BigInt(0));
      approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(approvedAllowance).to.be.equal(approvalAmount);
    });

    it("Should correctly take into account the validity time when calculating approvals", async function () {
      const approvalAmount = ethers.parseEther("10");
      let tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        DEFINITELY_FUTURE
      );
      await tx.wait();
      tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        DEFINITELY_FUTURE
      );
      await tx.wait();
      let approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(approvedAllowance).to.be.equal(approvalAmount * BigInt(2));
      // Set another that will become valid in the near future
      const lastTimestamp = await fetchLatestTimestamp(
        deploymentWallet.provider
      );
      tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        lastTimestamp + 10
      );
      await tx.wait();
      approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(approvedAllowance).to.be.equal(approvalAmount * BigInt(2));
      // Wait for the last one to become valid
      await sleepUntil((lastTimestamp + 10) * 1000);
      // To check this, we have to rely on the rejection logic, because
      // otherwise we're not creating a block, and the timestamp won't change
      // We won't be allowed to spend more than approvalAmount * 2 if the
      // last approval is not yet valid
      tx = await testContract.spend(
        TOKEN_ADDRESS_1,
        approvalAmount * BigInt(3)
      );
      await tx.wait();
      approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
    });

    it("Should correctly account for cancels when calculating allowance", async function () {
      const approvalAmount = ethers.parseEther("10");
      const toCancelAmount = ethers.parseEther("5");
      let tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        toCancelAmount,
        ALREADY_PAST
      );
      await tx.wait();
      // Rely on the fact that the state store's the previous ID (of the allowance)
      const idToCancel = await testContract.lastAllowanceId(TOKEN_ADDRESS_1);
      console.log("ID to cancel: ", idToCancel);
      tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      const withoutCancelled = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(withoutCancelled).to.be.equal(
        approvalAmount * BigInt(2) + toCancelAmount
      );

      tx = await testContract.cancelAllowance(TOKEN_ADDRESS_1, idToCancel);
      await tx.wait();
      let approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(approvedAllowance).to.be.equal(BigInt(2) * approvalAmount);
    });
  });

  describe("Spend tracking & limiting in the face of pre-approved allowances - limits at zero", async function () {
    beforeEach(async function () {
      testContract = await deployContract(
        "TestRiskLimited",
        // Use a time window of 1000s for these tests
        // the important thing is that everything happens in a single window
        [1000, "0x00"],
        { wallet: deploymentWallet, silent: true }
      );
    });

    it("Spends should correctly reduce the allowances", async function () {
      const approvalAmount = ethers.parseEther("10");
      let tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      tx = await testContract.spend(TOKEN_ADDRESS_1, ethers.parseEther("5"));
      await tx.wait();
      let approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(approvedAllowance).to.be.equal(ethers.parseEther("5"));
      tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(approvedAllowance).to.be.equal(ethers.parseEther("15"));
      tx = await testContract.spend(TOKEN_ADDRESS_1, ethers.parseEther("15"));
      await tx.wait();
      approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(approvedAllowance).to.be.equal(ethers.parseEther("0"));
    });

    it("Should block spends that are above the remaining allowances", async function () {
      const approvalAmount = ethers.parseEther("10");
      let tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      tx = await testContract.spend(TOKEN_ADDRESS_1, ethers.parseEther("5"));
      await tx.wait();
      await expect(
        testContract.spend(TOKEN_ADDRESS_1, approvalAmount)
      ).to.be.rejectedWith("Risk limit exceeded");
    });
  });

  describe("Spend tracking & limiting in the face of pre-approved allowances - non-zero limits", async function () {
    const theLimit = ethers.parseEther("2");

    beforeEach(async function () {
      testContract = await deployContract(
        "TestRiskLimited",
        // Use a time window of 1000s for these tests
        // the important thing is that everything happens in a single window
        [1000, serializeBigInt(theLimit)],
        { wallet: deploymentWallet, silent: true }
      );
    });

    it("Spends below the limit should reduce the available within the time window and not affect allowances", async function () {
      const approvalAmount = ethers.parseEther("10");
      let tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      tx = await testContract.spend(TOKEN_ADDRESS_1, theLimit);
      await tx.wait();
      let approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(approvedAllowance).to.be.equal(approvalAmount);
    });

    it("Spends above the limit will only be allowed if sufficient allowances are available, and will reduce the allowance accordingly", async function () {
      const approvalAmount = ethers.parseEther("10");
      let tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      tx = await testContract.spend(TOKEN_ADDRESS_1, ethers.parseEther("15"));
      await tx.wait();
      // NOTE we've consumed all but 5 from the allowances
      let approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(approvedAllowance).to.be.equal(ethers.parseEther("5"));
      // We should still be able to spend below the limit independently of the allowances
      tx = await testContract.spend(TOKEN_ADDRESS_1, theLimit);
      await tx.wait();
      approvedAllowance = await testContract.allowanceAvailable(
        senderAddress,
        TOKEN_ADDRESS_1
      );
      expect(approvedAllowance).to.be.equal(ethers.parseEther("5"));
    });

    it("Spends that that are above the limit, and above the available allowances, will be blocked", async function () {
      const approvalAmount = ethers.parseEther("10");
      let tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      tx = await testContract.addAllowance(
        TOKEN_ADDRESS_1,
        approvalAmount,
        ALREADY_PAST
      );
      await tx.wait();
      tx = await testContract.spend(TOKEN_ADDRESS_1, ethers.parseEther("5"));
      await tx.wait();
      // NOTE: chosen 17, since this is remaining allowance (15) + remaining limit (2)
      // hence proving the buckets are independent
      await expect(
        testContract.spend(TOKEN_ADDRESS_1, ethers.parseEther("17"))
      ).to.be.rejectedWith("Risk limit exceeded");
    });
  });
});
