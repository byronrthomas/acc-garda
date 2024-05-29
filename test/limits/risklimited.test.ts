import { expect } from "chai";
import { Contract, Wallet, utils } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
  transferEth,
} from "../../scripts/utils";
import { makeArbitraryWallet } from "../utils";
import { ethers } from "ethers";
import { PaymasterParams } from "zksync-ethers/build/types";

const NO_LIMIT = ethers.MaxUint256;
const TOKEN_ADDRESS_1 = ethers.hexlify(ethers.randomBytes(20));
const TOKEN_ADDRESS_2 = ethers.hexlify(ethers.randomBytes(20));
const ETHER_TOKEN = ethers.ZeroAddress;

function sleepUntil(finalTimeMs) {
  const timeToSleep = finalTimeMs - Date.now();
  if (timeToSleep > 0) {
    console.log("Going to wait for ", timeToSleep, "ms");
    return new Promise((resolve) => setTimeout(resolve, timeToSleep));
  } else {
    console.log("Time already passed, no need to sleep");
    return Promise.resolve();
  }
}

describe("RiskLimited test (mix-in)", function () {
  let deploymentWallet: Wallet;
  let testContract: Contract;

  describe("Limit management - specific token limits vs default limit", async function () {
    const initialDefaultLimit = ethers.parseEther("10");

    beforeEach(async function () {
      deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
      testContract = await deployContract(
        "TestRiskLimited",
        // Let's not worry about time for this set of tests
        [1000, "0x" + initialDefaultLimit.toString(16)],
        { wallet: deploymentWallet, silent: true }
      );
    });

    it("Should return the default limit for any token if no other overrides set", async function () {
      let limit = await testContract.limitForToken(ETHER_TOKEN);
      expect(limit).to.be.equal(initialDefaultLimit);
      limit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(limit).to.be.equal(initialDefaultLimit);
    });

    it("Specific spending limit should override default for just that token", async function () {
      const newLimit = ethers.parseEther("5");
      const tx = await testContract.setSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      let limit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(limit).to.be.equal(newLimit);
      limit = await testContract.limitForToken(TOKEN_ADDRESS_2);
      expect(limit).to.be.equal(initialDefaultLimit);
      limit = await testContract.limitForToken(ETHER_TOKEN);
      expect(limit).to.be.equal(initialDefaultLimit);
    });

    it("Should return the updated default limit for any tokens without specifics", async function () {
      const tx = await testContract.setSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        ethers.parseEther("5")
      );
      await tx.wait();

      const newDefaultLimit = ethers.parseEther("20");
      const tx2 = await testContract.setDefaultRiskLimit(newDefaultLimit);
      await tx2.wait();
      let limit = await testContract.limitForToken(ETHER_TOKEN);
      expect(limit).to.be.equal(newDefaultLimit);
      limit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(limit).to.be.equal(ethers.parseEther("5"));
      limit = await testContract.limitForToken(TOKEN_ADDRESS_2);
      expect(limit).to.be.equal(newDefaultLimit);
    });

    it("Should remove the specific limit for only the token requested", async function () {
      let tx = await testContract.setSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        ethers.parseEther("5")
      );
      await tx.wait();
      tx = await testContract.setSpecificRiskLimit(
        TOKEN_ADDRESS_2,
        ethers.parseEther("5")
      );
      await tx.wait();
      tx = await testContract.removeSpecificRiskLimit(TOKEN_ADDRESS_1);
      await tx.wait();
      let limit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(limit).to.be.equal(initialDefaultLimit);
      limit = await testContract.limitForToken(TOKEN_ADDRESS_2);
      expect(limit).to.be.equal(ethers.parseEther("5"));
    });

    it("Should allow setting the default limit to NO_LIMIT whilst still having a limit for ETH", async function () {
      let tx = await testContract.setDefaultRiskLimit(NO_LIMIT);
      await tx.wait();
      tx = await testContract.setSpecificRiskLimit(
        ETHER_TOKEN,
        ethers.parseEther("11")
      );
      await tx.wait();
      let limit = await testContract.limitForToken(ETHER_TOKEN);
      expect(limit).to.be.equal(ethers.parseEther("11"));
      limit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(limit).to.be.equal(NO_LIMIT);
    });
  });

  describe("Spend tracking & limiting (single long time window)", async function () {
    const theLimit = ethers.parseEther("10");
    beforeEach(async function () {
      deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
      testContract = await deployContract(
        "TestRiskLimited",
        // Use a time window of 1000s for these tests
        // the important thing is that everything happens in a single window
        [1000, "0x" + theLimit.toString(16)],
        { wallet: deploymentWallet, silent: true }
      );
    });

    it("Should block an individual spend that exceeds the limit", async function () {
      try {
        await testContract.spend(
          TOKEN_ADDRESS_1,
          theLimit + ethers.parseEther("1")
        );
      } catch (e) {
        expect(e.message).to.contain(
          "Risk limit exceeded - transaction amount above limit"
        );
      }
    });

    it("Should block a series of spends that exceed the limit within the time window", async function () {
      for (let i = 0; i < 5; i++) {
        let tx = await testContract.spend(ETHER_TOKEN, ethers.parseEther("2"));
        await tx.wait();
      }
      try {
        await testContract.spend(ETHER_TOKEN, ethers.parseEther("1"));
      } catch (e) {
        expect(e.message).to.contain(
          "Risk limit exceeded - total amount above limit"
        );
      }
    });

    it("Should allow a series of spends that sum to less or equal than the limit, within the window", async function () {
      for (let i = 0; i < 5; i++) {
        let tx = await testContract.spend(ETHER_TOKEN, ethers.parseEther("2"));
        await tx.wait();
      }
      const spends = await testContract.spends(ETHER_TOKEN);
      expect(spends[0]).to.be.equal(ethers.parseEther("10"));
    });

    it("Should allow a spend for a different token to the one that has been spent to the limit", async function () {
      let tx = await testContract.spend(TOKEN_ADDRESS_1, theLimit);
      await tx.wait();
      tx = await testContract.spend(TOKEN_ADDRESS_2, ethers.parseEther("1"));
      await tx.wait();
      const spends1 = await testContract.spends(TOKEN_ADDRESS_1);
      expect(spends1[0]).to.be.equal(theLimit);
      const spends2 = await testContract.spends(TOKEN_ADDRESS_2);
      expect(spends2[0]).to.be.equal(ethers.parseEther("1"));
    });
  });

  describe("Spend tracking & limiting (multiple short time windows)", async function () {
    const theLimit = ethers.parseEther("10");
    beforeEach(async function () {
      deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
      testContract = await deployContract(
        "TestRiskLimited",
        // Use a time window of 5s for these tests
        [5, "0x" + theLimit.toString(16)],
        { wallet: deploymentWallet, silent: true }
      );
    });

    it("Should allow two spends at the limit, separated by the time window", async function () {
      const startTime = Date.now();
      let tx = await testContract.spend(TOKEN_ADDRESS_1, theLimit);
      await tx.wait();
      // Wait for the time window to elapse
      await sleepUntil(startTime + 6000);
      tx = await testContract.spend(TOKEN_ADDRESS_1, theLimit);
      await tx.wait();
      const spends = await testContract.spends(TOKEN_ADDRESS_1);
      console.log("Spends: ", spends);
      expect(spends[0]).to.be.equal(theLimit);
    });

    it("Limitation: it allows more than the limit to be spent within a single time window, when you see e.g. 1ETH, 8ETH, then after window 10ETH", async function () {
      let tx = await testContract.spend(ETHER_TOKEN, ethers.parseEther("1"));
      const startTime = Date.now();
      await tx.wait();
      tx = await testContract.spend(ETHER_TOKEN, ethers.parseEther("8"));
      await tx.wait();
      // Wait for the time window - timed from the 1 ETH tx to elapse
      await sleepUntil(startTime + 5000);
      // Now it will allow another 10ETH spend, even though 10ETH + 8ETH have passed within one period
      tx = await testContract.spend(ETHER_TOKEN, ethers.parseEther("10"));
      await tx.wait();
      const spends = await testContract.spends(ETHER_TOKEN);
      expect(spends[0]).to.be.equal(ethers.parseEther("10"));
    });
  });

  describe("Time window management", async function () {
    it("Limitation: allows new transactions as time window decreased (window shrunk historically)", async function () {
      const theLimit = ethers.parseEther("10");
      deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
      testContract = await deployContract(
        "TestRiskLimited",
        // Use a time window of 1m for these tests
        // (long enough that we should still be in the initial window when we change time window)
        [60, "0x" + theLimit.toString(16)],
        { wallet: deploymentWallet, silent: true }
      );
      let tx = await testContract.spend(TOKEN_ADDRESS_2, theLimit);
      await tx.wait();
      // Wait for a shorter time window to elapse
      await sleepUntil(Date.now() + 2000);
      // Change window to 2s
      tx = await testContract.setRiskLimitTimeWindow(2);
      await tx.wait();
      // Now it should be possible to spend the limit again
      tx = await testContract.spend(TOKEN_ADDRESS_2, theLimit);
      await tx.wait();
      const spends = await testContract.spends(TOKEN_ADDRESS_2);
      expect(spends[0]).to.be.equal(theLimit);
    });

    it("Correctly blocks new transactions as time window increased (existing windows expanded)", async function () {
      const theLimit = ethers.parseEther("10");
      deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
      testContract = await deployContract(
        "TestRiskLimited",
        // Use a time window of 2s initially - should be short enough to catch us if the window
        // doesn't get expanded
        [2, "0x" + theLimit.toString(16)],
        { wallet: deploymentWallet, silent: true }
      );
      let tx = await testContract.spend(ETHER_TOKEN, theLimit);
      await tx.wait();
      // Wait for a shorter time window to elapse
      await sleepUntil(Date.now() + 2000);
      // Change window to 1m
      tx = await testContract.setRiskLimitTimeWindow(60);
      await tx.wait();
      // Now it should be possible to spend the limit again
      try {
        await testContract.spend(ETHER_TOKEN, theLimit);
      } catch (e) {
        expect(e.message).to.contain(
          "Risk limit exceeded - total amount above limit"
        );
      }
    });
  });

  describe("When disabled by setting the extreme values", async function () {
    let contractWithoutLimits: Contract;
    before(async function () {
      deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
      contractWithoutLimits = await deployContract(
        "TestRiskLimited",
        // Set the extreme values
        [0, "0x" + NO_LIMIT.toString(16)],
        { wallet: deploymentWallet, silent: true }
      );
    });

    it("Should allow any spend when the limit is set to NO_LIMIT", async function () {
      let tx = await contractWithoutLimits.spend(
        ETHER_TOKEN,
        ethers.parseEther("100000")
      );
      await tx.wait();
      tx = await contractWithoutLimits.spend(
        ETHER_TOKEN,
        ethers.parseEther("100000")
      );
      await tx.wait();
      tx = await contractWithoutLimits.spend(
        TOKEN_ADDRESS_1,
        ethers.parseEther("100000")
      );
      await tx.wait();
      tx = await contractWithoutLimits.spend(
        TOKEN_ADDRESS_1,
        ethers.parseEther("100000")
      );
      await tx.wait();
    });
  });
});
