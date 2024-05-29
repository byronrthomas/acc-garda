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
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const { expect } = chai;

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

const serializeBigInt = (value: bigint) => {
  return "0x" + value.toString(16);
};

describe("GuardedRiskLimits (mix-in)", function () {
  let testContract: Contract;
  let guardian1ContractConnection: Contract;
  let guardian2ContractConnection: Contract;
  let guardian3ContractConnection: Contract;
  let ownerContractConnection: Contract;
  let deploymentWallet: Wallet;
  const guardianWallet1: Wallet = makeArbitraryWallet();
  const guardianWallet2: Wallet = makeArbitraryWallet();
  const guardianWallet3: Wallet = makeArbitraryWallet();
  const ownerWallet: Wallet = makeArbitraryWallet();
  // Add some duplicates just to be sure
  const constructorInputArray = [
    guardianWallet1.address,
    guardianWallet2.address,
    guardianWallet3.address,
  ];
  const initialTimeWindow = 1000;
  const initialDefaultLimit = ethers.parseEther("10");

  const reinitializeContract = async function () {
    testContract = await deployContract(
      "GuardedRiskLimits",
      // Let's do a 2 of 3 approval mechanism
      [
        initialTimeWindow,
        serializeBigInt(initialDefaultLimit),
        constructorInputArray,
        ownerWallet.address,
        2,
      ],
      { wallet: deploymentWallet, silent: true }
    );
    const contractAddress = await testContract.getAddress();
    guardian1ContractConnection = new Contract(
      contractAddress,
      testContract.interface,
      guardianWallet1
    );
    guardian2ContractConnection = new Contract(
      contractAddress,
      testContract.interface,
      guardianWallet2
    );
    guardian3ContractConnection = new Contract(
      contractAddress,
      testContract.interface,
      guardianWallet3
    );
    ownerContractConnection = new Contract(
      contractAddress,
      testContract.interface,
      ownerWallet
    );
  };

  const setupWallets = async function () {
    deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    // Ensure all the guardians can pay their own fees
    await transferEth(deploymentWallet, guardianWallet1.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet2.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet3.address, "0.02");
    await transferEth(deploymentWallet, ownerWallet.address, "0.02");
  };

  describe("Default limit management - rejections & non-changes", async function () {
    before(async function () {
      await setupWallets();
      await reinitializeContract();
    });

    it("Should reject a non-guardian call to voteForDefaultRiskLimitIncrease", async function () {
      await expect(
        testContract.voteForDefaultRiskLimitIncrease(initialDefaultLimit)
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should reject an owner call to voteForDefaultRiskLimitIncrease", async function () {
      await expect(
        ownerContractConnection.voteForDefaultRiskLimitIncrease(
          initialDefaultLimit
        )
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should reject an owner call to increaseDefaultRiskLimit (since votes required > 0)", async function () {
      await expect(
        ownerContractConnection.increaseDefaultRiskLimit(
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith(
        "This action can only be performed via the guardians voting"
      );
    });

    it("Should reject a guardian call to decreaseDefaultRiskLimit", async function () {
      await expect(
        guardian1ContractConnection.decreaseDefaultRiskLimit(
          initialDefaultLimit
        )
      ).to.be.rejectedWith("caller is not the owner");
    });

    it("Should reject a guardian call to increaseDefaultRiskLimit", async function () {
      await expect(
        guardian1ContractConnection.increaseDefaultRiskLimit(
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith("caller is not the owner");
    });

    it("Should reject an owner call to decreaseDefaultRiskLimit that actually increases the limit", async function () {
      await expect(
        ownerContractConnection.decreaseDefaultRiskLimit(
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith("Cannot immediately increase risk");
    });

    it("Should not change the limit if the same guardian votes many times", async function () {
      const newLimit = ethers.parseEther("30");
      let tx =
        await guardian1ContractConnection.voteForDefaultRiskLimitIncrease(
          newLimit
        );
      await tx.wait();
      let currentLimit = await testContract.defaultRiskLimit();
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian1ContractConnection.voteForDefaultRiskLimitIncrease(
        newLimit
      );
      await tx.wait();
      currentLimit = await testContract.defaultRiskLimit();
      expect(currentLimit).to.be.equal(initialDefaultLimit);
    });

    it("Should not change the limit if guardians keep voting for different limits", async function () {
      let tx =
        await guardian1ContractConnection.voteForDefaultRiskLimitIncrease(
          ethers.parseEther("40")
        );
      await tx.wait();
      let currentLimit = await testContract.defaultRiskLimit();
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian2ContractConnection.voteForDefaultRiskLimitIncrease(
        ethers.parseEther("50")
      );
      await tx.wait();
      // NOTE: although we've had enough votes from different guardians, they're for different values
      currentLimit = await testContract.defaultRiskLimit();
      expect(currentLimit).to.be.equal(initialDefaultLimit);
    });
  });

  describe("Default limit management - changes", async function () {
    before(async function () {
      await setupWallets();
    });
    beforeEach(async function () {
      await reinitializeContract();
    });

    it("Should set an increased limit if the required number of guardians vote", async function () {
      const newLimit = ethers.parseEther("20");
      let tx =
        await guardian1ContractConnection.voteForDefaultRiskLimitIncrease(
          newLimit
        );
      await tx.wait();
      let currentLimit = await testContract.defaultRiskLimit();
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian3ContractConnection.voteForDefaultRiskLimitIncrease(
        newLimit
      );
      await tx.wait();
      currentLimit = await testContract.defaultRiskLimit();
      expect(currentLimit).to.be.equal(newLimit);
    });

    it("Should allow the owner to decrease the default limit", async function () {
      const newLimit = ethers.parseEther("5");
      let tx = await ownerContractConnection.decreaseDefaultRiskLimit(newLimit);
      await tx.wait();
      let currentLimit = await testContract.defaultRiskLimit();
      expect(currentLimit).to.be.equal(newLimit);
    });
  });

  describe("Specific limit management - rejections & non-changes (no pre-existing value)", async function () {
    before(async function () {
      await setupWallets();
      await reinitializeContract();
    });

    it("Should reject a non-guardian call to voteForSpecificRiskLimitIncrease", async function () {
      await expect(
        testContract.voteForSpecificRiskLimitIncrease(
          TOKEN_ADDRESS_1,
          initialDefaultLimit
        )
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should reject an owner call to voteForSpecificRiskLimitIncrease", async function () {
      await expect(
        ownerContractConnection.voteForSpecificRiskLimitIncrease(
          TOKEN_ADDRESS_1,
          initialDefaultLimit
        )
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should reject an owner call to increaseSpecificRiskLimit (since votes required > 0)", async function () {
      await expect(
        ownerContractConnection.increaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith(
        "This action can only be performed via the guardians voting"
      );
    });

    it("Should reject a guardian call to decreaseSpecificRiskLimit", async function () {
      await expect(
        guardian1ContractConnection.decreaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          initialDefaultLimit
        )
      ).to.be.rejectedWith("caller is not the owner");
    });

    it("Should reject a guardian call to increaseSpecificRiskLimit", async function () {
      await expect(
        guardian1ContractConnection.increaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith("caller is not the owner");
    });

    it("Should reject an owner call to decreaseSpecificRiskLimit that actually increases the limit", async function () {
      await expect(
        ownerContractConnection.decreaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,

          ethers.parseEther("20")
        )
      ).to.be.rejectedWith(
        "Cannot immediately increase risk limit, need guardians approval"
      );
    });

    it("Should not change the limit if the same guardian votes many times", async function () {
      const newLimit = ethers.parseEther("30");
      let tx =
        await guardian1ContractConnection.voteForSpecificRiskLimitIncrease(
          TOKEN_ADDRESS_1,
          newLimit
        );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian1ContractConnection.voteForSpecificRiskLimitIncrease(
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(initialDefaultLimit);
    });

    it("Should not change the limit if guardians keep voting for different limits", async function () {
      let tx =
        await guardian1ContractConnection.voteForSpecificRiskLimitIncrease(
          TOKEN_ADDRESS_1,
          ethers.parseEther("40")
        );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian2ContractConnection.voteForSpecificRiskLimitIncrease(
        TOKEN_ADDRESS_1,
        ethers.parseEther("50")
      );
      await tx.wait();
      // NOTE: although we've had enough votes from different guardians, they're for different values
      currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(initialDefaultLimit);
    });
  });

  describe("Specific limit management - changes without a pre-existing override", async function () {
    before(async function () {
      await setupWallets();
    });
    beforeEach(async function () {
      await reinitializeContract();
    });

    it("Should set an increased limit if the required number of guardians vote", async function () {
      const newLimit = ethers.parseEther("20");
      let tx =
        await guardian1ContractConnection.voteForSpecificRiskLimitIncrease(
          TOKEN_ADDRESS_1,
          newLimit
        );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian3ContractConnection.voteForSpecificRiskLimitIncrease(
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(newLimit);
    });

    it("Should allow the owner to decrease the limit", async function () {
      const newLimit = ethers.parseEther("5");
      let tx = await ownerContractConnection.decreaseSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(newLimit);
    });
  });

  describe("Specific limit management - with a pre-existing override for token", async function () {
    const initialPerTokenLimit = ethers.parseEther("8");
    before(async function () {
      await setupWallets();
    });
    beforeEach(async function () {
      await reinitializeContract();
      let tx = await ownerContractConnection.decreaseSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        initialPerTokenLimit
      );
      await tx.wait();
      expect(await testContract.limitForToken(TOKEN_ADDRESS_1)).to.be.equal(
        initialPerTokenLimit
      );
    });

    it("Should reject an owner call to decreaseSpecificRiskLimit that actually increases the limit", async function () {
      await expect(
        ownerContractConnection.decreaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          // NOTE: this won't apply unless it's checking the per-token limit
          ethers.parseEther("9")
        )
      ).to.be.rejectedWith(
        "Cannot immediately increase risk limit, need guardians approval"
      );
    });

    it("Should reject an owner call to increaseSpecificRiskLimit (since votes required > 0)", async function () {
      await expect(
        ownerContractConnection.increaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          ethers.parseEther("9")
        )
      ).to.be.rejectedWith(
        "This action can only be performed via the guardians voting"
      );
    });

    it("Should reject a guardian call to increaseSpecificRiskLimit", async function () {
      await expect(
        guardian1ContractConnection.increaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          ethers.parseEther("9")
        )
      ).to.be.rejectedWith("caller is not the owner");
    });

    it("Should set an increased limit if the required number of guardians vote", async function () {
      const newLimit = ethers.parseEther("20");
      let tx =
        await guardian1ContractConnection.voteForSpecificRiskLimitIncrease(
          TOKEN_ADDRESS_1,
          newLimit
        );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(initialPerTokenLimit);
      tx = await guardian3ContractConnection.voteForSpecificRiskLimitIncrease(
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(newLimit);
    });

    it("Should allow the owner to decrease the limit", async function () {
      const newLimit = ethers.parseEther("2");
      let tx = await ownerContractConnection.decreaseSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(newLimit);
    });
  });

  describe("Time window management - rejections & non-changes", async function () {
    before(async function () {
      await setupWallets();
      await reinitializeContract();
    });

    it("Should reject a non-guardian call to voteForRiskLimitTimeWindowDecrease", async function () {
      await expect(
        testContract.voteForRiskLimitTimeWindowDecrease(initialTimeWindow)
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should reject an owner call to voteForRiskLimitTimeWindowDecrease", async function () {
      await expect(
        ownerContractConnection.voteForRiskLimitTimeWindowDecrease(
          initialTimeWindow
        )
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should reject an owner call to decreaseRiskLimitTimeWindow (since votes required > 0)", async function () {
      await expect(
        ownerContractConnection.decreaseRiskLimitTimeWindow(4)
      ).to.be.rejectedWith(
        "This action can only be performed via the guardians voting"
      );
    });

    it("Should reject a guardian call to increaseRiskLimitTimeWindow", async function () {
      await expect(
        guardian1ContractConnection.increaseRiskLimitTimeWindow(
          initialTimeWindow
        )
      ).to.be.rejectedWith("caller is not the owner");
    });

    it("Should reject a guardian call to decreaseRiskLimitTimeWindow", async function () {
      await expect(
        guardian1ContractConnection.decreaseRiskLimitTimeWindow(4)
      ).to.be.rejectedWith("caller is not the owner");
    });

    it("Should reject an owner call to increaseRiskLimitTimeWindow that actually decreases the window", async function () {
      await expect(
        ownerContractConnection.increaseRiskLimitTimeWindow(10)
      ).to.be.rejectedWith(
        "Cannot immediately decrease time window, needs guardians approval"
      );
    });

    it("Should not change the limit if the same guardian votes many times", async function () {
      const newWindow = 10;
      let tx =
        await guardian1ContractConnection.voteForRiskLimitTimeWindowDecrease(
          newWindow
        );
      await tx.wait();
      let currentWindow = await testContract.riskLimitTimeWindow();
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
      tx = await guardian1ContractConnection.voteForRiskLimitTimeWindowDecrease(
        newWindow
      );
      await tx.wait();
      currentWindow = await testContract.riskLimitTimeWindow();
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
    });

    it("Should not change the limit if guardians keep voting for different limits", async function () {
      let tx =
        await guardian1ContractConnection.voteForRiskLimitTimeWindowDecrease(
          100
        );
      await tx.wait();
      let currentWindow = await testContract.riskLimitTimeWindow();
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
      tx = await guardian2ContractConnection.voteForRiskLimitTimeWindowDecrease(
        10
      );
      await tx.wait();
      // NOTE: although we've had enough votes from different guardians, they're for different values
      currentWindow = await testContract.riskLimitTimeWindow();
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
    });
  });

  describe("Time window management - changes", async function () {
    before(async function () {
      await setupWallets();
    });
    beforeEach(async function () {
      await reinitializeContract();
    });

    it("Should set an decreased window if the required number of guardians vote", async function () {
      const newWindow = 50;
      let tx =
        await guardian1ContractConnection.voteForRiskLimitTimeWindowDecrease(
          newWindow
        );
      await tx.wait();
      let currentWindow = await testContract.riskLimitTimeWindow();
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
      tx = await guardian3ContractConnection.voteForRiskLimitTimeWindowDecrease(
        newWindow
      );
      await tx.wait();
      currentWindow = await testContract.riskLimitTimeWindow();
      expect(currentWindow).to.be.equal(BigInt(newWindow));
    });

    it("Should allow the owner to increase the time window", async function () {
      const newWindow = 50000;
      let tx = await ownerContractConnection.increaseRiskLimitTimeWindow(
        newWindow
      );
      await tx.wait();
      let currentWindow = await testContract.riskLimitTimeWindow();
      expect(currentWindow).to.be.equal(BigInt(newWindow));
    });
  });

  describe("When guardian voting is disable (zero required approvals)", async function () {
    before(async function () {
      await setupWallets();
      testContract = await deployContract(
        "GuardedRiskLimits",
        // 0 required approvals
        [
          initialTimeWindow,
          serializeBigInt(initialDefaultLimit),
          [],
          ownerWallet.address,
          0,
        ],
        { wallet: deploymentWallet, silent: true }
      );
      const contractAddress = await testContract.getAddress();
      ownerContractConnection = new Contract(
        contractAddress,
        testContract.interface,
        ownerWallet
      );
      guardian1ContractConnection = new Contract(
        contractAddress,
        testContract.interface,
        guardianWallet1
      );
    });

    it("Should allow the owner to increase the default limit", async function () {
      const newLimit = ethers.parseEther("20");
      let tx = await ownerContractConnection.increaseDefaultRiskLimit(newLimit);
      await tx.wait();
      let currentLimit = await testContract.defaultRiskLimit();
      expect(currentLimit).to.be.equal(newLimit);
    });

    it("Should reject a guardian call to increaseDefaultRiskLimit", async function () {
      await expect(
        guardian1ContractConnection.increaseDefaultRiskLimit(
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith("caller is not the owner");
    });

    it("Should allow the owner to increase a specific limit", async function () {
      // NOTE: needs to be bigger than what we set the default to
      const newLimit = ethers.parseEther("50");
      let tx = await ownerContractConnection.increaseSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(TOKEN_ADDRESS_1);
      expect(currentLimit).to.be.equal(newLimit);
    });

    it("Should reject a guardian call to increaseSpecificRiskLimit", async function () {
      await expect(
        guardian1ContractConnection.increaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith("caller is not the owner");
    });

    it("Should allow the owner to decrease the time window", async function () {
      const newWindow = 50;
      let tx = await ownerContractConnection.decreaseRiskLimitTimeWindow(
        newWindow
      );
      await tx.wait();
      let currentWindow = await testContract.riskLimitTimeWindow();
      expect(currentWindow).to.be.equal(BigInt(newWindow));
    });

    it("Should reject a guardian call to decreaseRiskLimitTimeWindow", async function () {
      await expect(
        guardian1ContractConnection.decreaseRiskLimitTimeWindow(4)
      ).to.be.rejectedWith("caller is not the owner");
    });
  });
});
