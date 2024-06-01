import { Contract, Wallet, utils } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
  transferEth,
} from "../../scripts/utils";
import {
  makeArbitraryWallet,
  makeTimestampSecs,
  makeTimestampSecsNow,
  serializeBigInt,
} from "../utils";
import { ethers } from "ethers";
import { PaymasterParams } from "zksync-ethers/build/types";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";
import { ETH_ADDRESS } from "zksync-ethers/build/utils";

chai.use(chaiAsPromised);
const { expect } = chai;

const TOKEN_ADDRESS_1 = ethers.hexlify(ethers.randomBytes(20));
const TOKEN_ADDRESS_2 = ethers.hexlify(ethers.randomBytes(20));

const DEFINITELY_PAST = makeTimestampSecs(new Date(2021, 0, 1));
const DEFINITELY_FUTURE = makeTimestampSecs(new Date(2030, 0, 1));

describe("RiskManager", function () {
  let testContract: Contract;
  let contractAddress: string;
  let guardianRegistry: Contract;
  let guardianRegistryAddress: string;
  let guardian1ContractConnection: Contract;
  let guardian2ContractConnection: Contract;
  let guardian3ContractConnection: Contract;
  let deploymentWallet: Wallet;
  const guardianWallet1: Wallet = makeArbitraryWallet();
  const guardianWallet2: Wallet = makeArbitraryWallet();
  const guardianWallet3: Wallet = makeArbitraryWallet();
  // Add some duplicates just to be sure
  const constructorInputArray = [
    guardianWallet1.address,
    guardianWallet2.address,
    guardianWallet3.address,
  ];
  const initialTimeWindow = 1000;
  const initialDefaultLimit = ethers.parseEther("10");

  const reinitializeForArbitraryOwner = async function () {
    const ownerWallet = makeArbitraryWallet();
    const ownerAddress = ownerWallet.address;
    let tx = await guardianRegistry.setGuardiansFor(
      ownerAddress,
      constructorInputArray
    );
    await tx.wait();
    tx = await testContract.initialiseRiskParams(
      ownerAddress,
      initialTimeWindow,
      serializeBigInt(initialDefaultLimit),
      // Let's do a 2 of 3 approval mechanism
      2
    );
    await tx.wait();
    const ownerContractConnection = new Contract(
      contractAddress,
      testContract.interface,
      ownerWallet
    );
    await transferEth(deploymentWallet, ownerWallet.address, "0.02");
    return { ownerContractConnection, ownerAddress };
  };

  const deployAll = async function () {
    deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    guardianRegistry = await deployContract("GuardianRegistry", [], {
      wallet: deploymentWallet,
      silent: true,
    });
    guardianRegistryAddress = await guardianRegistry.getAddress();
    testContract = await deployContract(
      "RiskManager",
      [guardianRegistryAddress],
      { wallet: deploymentWallet, silent: true }
    );

    // Setup connections to the contract from guardians
    contractAddress = await testContract.getAddress();
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

    // Ensure all the guardians can pay their own fees
    await transferEth(deploymentWallet, guardianWallet1.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet2.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet3.address, "0.02");
  };

  before(async function () {
    // Just deploy the contracts once to try to save time
    await deployAll();
  });

  describe("After deployment", async function () {
    let ownerContractConnection: Contract;
    let ownerAddress: string;
    before(async function () {
      ({ ownerContractConnection, ownerAddress } =
        await reinitializeForArbitraryOwner());
    });

    it("Should have it's initial values set correctly", async function () {
      console.log(
        `Going to ask contract ${await testContract.getAddress()} for account ${ownerAddress}`
      );
      let currentLimit = await testContract.defaultRiskLimit(ownerAddress);
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      let currentWindow = await testContract.riskLimitTimeWindow(ownerAddress);
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
      let numSignatures = await testContract.numVotesRequired(ownerAddress);
      expect(numSignatures).to.be.equal(BigInt(2));
    });

    it("Should not be possible to re-initialise params", async function () {
      await expect(
        testContract.initialiseRiskParams(
          ownerAddress,
          initialTimeWindow,
          serializeBigInt(initialDefaultLimit),
          2
        )
      ).to.be.rejectedWith(
        "Risk parameters already set - use other methods to adjust them"
      );
    });
  });

  describe("Default limit management - rejections & non-changes", async function () {
    let ownerContractConnection: Contract;
    let ownerAddress: string;
    before(async function () {
      ({ ownerContractConnection, ownerAddress } =
        await reinitializeForArbitraryOwner());
    });

    it("Should reject a non-guardian call to voteForDefaultRiskLimitIncrease", async function () {
      await expect(
        testContract.voteForDefaultRiskLimitIncrease(
          ownerAddress,
          initialDefaultLimit
        )
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should reject an owner call to voteForDefaultRiskLimitIncrease", async function () {
      await expect(
        ownerContractConnection.voteForDefaultRiskLimitIncrease(
          ownerAddress,
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
      ).to.be.rejectedWith(
        "RiskManager: Risk parameters not initialised for account"
      );
    });

    it("Should reject a guardian call to increaseDefaultRiskLimit", async function () {
      await expect(
        guardian1ContractConnection.increaseDefaultRiskLimit(
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith(
        "RiskManager: Risk parameters not initialised for account"
      );
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
          ownerAddress,
          newLimit
        );
      await tx.wait();
      let currentLimit = await testContract.defaultRiskLimit(ownerAddress);
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian1ContractConnection.voteForDefaultRiskLimitIncrease(
        ownerAddress,
        newLimit
      );
      await tx.wait();
      currentLimit = await testContract.defaultRiskLimit(ownerAddress);
      expect(currentLimit).to.be.equal(initialDefaultLimit);
    });

    it("Should not change the limit if guardians keep voting for different limits", async function () {
      let tx =
        await guardian1ContractConnection.voteForDefaultRiskLimitIncrease(
          ownerAddress,
          ethers.parseEther("40")
        );
      await tx.wait();
      let currentLimit = await testContract.defaultRiskLimit(ownerAddress);
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian2ContractConnection.voteForDefaultRiskLimitIncrease(
        ownerAddress,
        ethers.parseEther("50")
      );
      await tx.wait();
      // NOTE: although we've had enough votes from different guardians, they're for different values
      currentLimit = await testContract.defaultRiskLimit(ownerAddress);
      expect(currentLimit).to.be.equal(initialDefaultLimit);
    });
  });

  describe("Default limit management - changes", async function () {
    let ownerContractConnection: Contract;
    let ownerAddress: string;
    beforeEach(async function () {
      ({ ownerContractConnection, ownerAddress } =
        await reinitializeForArbitraryOwner());
    });

    it("Should set an increased limit if the required number of guardians vote", async function () {
      const newLimit = ethers.parseEther("20");
      let tx =
        await guardian1ContractConnection.voteForDefaultRiskLimitIncrease(
          ownerAddress,
          newLimit
        );
      await tx.wait();
      let currentLimit = await testContract.defaultRiskLimit(ownerAddress);
      console.log("Got current limit");
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian3ContractConnection.voteForDefaultRiskLimitIncrease(
        ownerAddress,
        newLimit
      );
      await tx.wait();
      currentLimit = await testContract.defaultRiskLimit(ownerAddress);
      expect(currentLimit).to.be.equal(newLimit);
    });

    it("Should allow the owner to decrease the default limit", async function () {
      const newLimit = ethers.parseEther("5");
      let tx = await ownerContractConnection.decreaseDefaultRiskLimit(newLimit);
      await tx.wait();
      let currentLimit = await testContract.defaultRiskLimit(ownerAddress);
      expect(currentLimit).to.be.equal(newLimit);
    });
  });

  describe("Specific limit management - rejections & non-changes (no pre-existing value)", async function () {
    let ownerContractConnection: Contract;
    let ownerAddress: string;
    before(async function () {
      ({ ownerContractConnection, ownerAddress } =
        await reinitializeForArbitraryOwner());
    });

    it("Should reject a non-guardian call to voteForSpecificRiskLimitIncrease", async function () {
      await expect(
        testContract.voteForSpecificRiskLimitIncrease(
          ownerAddress,
          TOKEN_ADDRESS_1,
          initialDefaultLimit
        )
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should reject an owner call to voteForSpecificRiskLimitIncrease", async function () {
      await expect(
        ownerContractConnection.voteForSpecificRiskLimitIncrease(
          ownerAddress,
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

    it("Should reject a guardian call to decreaseSpecificRiskLimit - because this call is trying to affect an account for the guardian, which has not been set up", async function () {
      await expect(
        guardian1ContractConnection.decreaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          initialDefaultLimit
        )
      ).to.be.rejectedWith("RiskManager: Risk parameters not initialised");
    });

    it("Should reject a guardian call to increaseSpecificRiskLimit - because this call is trying to affect an account for the guardian, which has not been set up", async function () {
      await expect(
        guardian1ContractConnection.increaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith(
        "RiskManager: Risk parameters not initialised for account"
      );
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
          ownerAddress,
          TOKEN_ADDRESS_1,
          newLimit
        );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian1ContractConnection.voteForSpecificRiskLimitIncrease(
        ownerAddress,
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(initialDefaultLimit);
    });

    it("Should not change the limit if guardians keep voting for different limits", async function () {
      let tx =
        await guardian1ContractConnection.voteForSpecificRiskLimitIncrease(
          ownerAddress,
          TOKEN_ADDRESS_1,
          ethers.parseEther("40")
        );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian2ContractConnection.voteForSpecificRiskLimitIncrease(
        ownerAddress,
        TOKEN_ADDRESS_1,
        ethers.parseEther("50")
      );
      await tx.wait();
      // NOTE: although we've had enough votes from different guardians, they're for different values
      currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(initialDefaultLimit);
    });
  });

  describe("Specific limit management - changes without a pre-existing override", async function () {
    let ownerContractConnection: Contract;
    let ownerAddress: string;
    beforeEach(async function () {
      ({ ownerContractConnection, ownerAddress } =
        await reinitializeForArbitraryOwner());
    });

    it("Should set an increased limit if the required number of guardians vote", async function () {
      const newLimit = ethers.parseEther("20");
      let tx =
        await guardian1ContractConnection.voteForSpecificRiskLimitIncrease(
          ownerAddress,
          TOKEN_ADDRESS_1,
          newLimit
        );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(initialDefaultLimit);
      tx = await guardian3ContractConnection.voteForSpecificRiskLimitIncrease(
        ownerAddress,
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(newLimit);
    });

    it("Should allow the owner to decrease the limit", async function () {
      const newLimit = ethers.parseEther("5");
      let tx = await ownerContractConnection.decreaseSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(newLimit);
    });
  });

  describe("Specific limit management - with a pre-existing override for token", async function () {
    const initialPerTokenLimit = ethers.parseEther("8");
    let ownerContractConnection: Contract;
    let ownerAddress: string;
    beforeEach(async function () {
      ({ ownerContractConnection, ownerAddress } =
        await reinitializeForArbitraryOwner());

      let tx = await ownerContractConnection.decreaseSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        initialPerTokenLimit
      );
      await tx.wait();
      expect(
        await testContract.limitForToken(ownerAddress, TOKEN_ADDRESS_1)
      ).to.be.equal(initialPerTokenLimit);
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

    it("Should reject a guardian call to increaseSpecificRiskLimit - because this call is trying to affect an account for the guardian, which has not been set up", async function () {
      await expect(
        guardian1ContractConnection.increaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          ethers.parseEther("9")
        )
      ).to.be.rejectedWith(
        "RiskManager: Risk parameters not initialised for account"
      );
    });

    it("Should set an increased limit if the required number of guardians vote", async function () {
      const newLimit = ethers.parseEther("20");
      let tx =
        await guardian1ContractConnection.voteForSpecificRiskLimitIncrease(
          ownerAddress,
          TOKEN_ADDRESS_1,
          newLimit
        );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(initialPerTokenLimit);
      tx = await guardian3ContractConnection.voteForSpecificRiskLimitIncrease(
        ownerAddress,
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(newLimit);
    });

    it("Should allow the owner to decrease the limit", async function () {
      const newLimit = ethers.parseEther("2");
      let tx = await ownerContractConnection.decreaseSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(newLimit);
    });
  });

  describe("Time window management - rejections & non-changes", async function () {
    let ownerContractConnection: Contract;
    let ownerAddress: string;
    before(async function () {
      ({ ownerContractConnection, ownerAddress } =
        await reinitializeForArbitraryOwner());
    });

    it("Should reject a non-guardian call to voteForRiskLimitTimeWindowDecrease", async function () {
      await expect(
        testContract.voteForRiskLimitTimeWindowDecrease(
          ownerAddress,
          initialTimeWindow
        )
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should reject an owner call to voteForRiskLimitTimeWindowDecrease", async function () {
      await expect(
        ownerContractConnection.voteForRiskLimitTimeWindowDecrease(
          ownerAddress,
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

    it("Should reject a guardian call to increaseRiskLimitTimeWindow - because this call is trying to affect an account for the guardian, which has not been set up", async function () {
      await expect(
        guardian1ContractConnection.increaseRiskLimitTimeWindow(
          initialTimeWindow
        )
      ).to.be.rejectedWith(
        "RiskManager: Risk parameters not initialised for account"
      );
    });

    it("Should reject a guardian call to decreaseRiskLimitTimeWindow - because this call is trying to affect an account for the guardian, which has not been set up", async function () {
      await expect(
        guardian1ContractConnection.decreaseRiskLimitTimeWindow(4)
      ).to.be.rejectedWith(
        "RiskManager: Risk parameters not initialised for account"
      );
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
          ownerAddress,
          newWindow
        );
      await tx.wait();
      let currentWindow = await testContract.riskLimitTimeWindow(ownerAddress);
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
      tx = await guardian1ContractConnection.voteForRiskLimitTimeWindowDecrease(
        ownerAddress,
        newWindow
      );
      await tx.wait();
      currentWindow = await testContract.riskLimitTimeWindow(ownerAddress);
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
    });

    it("Should not change the limit if guardians keep voting for different limits", async function () {
      let tx =
        await guardian1ContractConnection.voteForRiskLimitTimeWindowDecrease(
          ownerAddress,
          100
        );
      await tx.wait();
      let currentWindow = await testContract.riskLimitTimeWindow(ownerAddress);
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
      tx = await guardian2ContractConnection.voteForRiskLimitTimeWindowDecrease(
        ownerAddress,
        10
      );
      await tx.wait();
      // NOTE: although we've had enough votes from different guardians, they're for different values
      currentWindow = await testContract.riskLimitTimeWindow(ownerAddress);
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
    });
  });

  describe("Time window management - changes", async function () {
    let ownerContractConnection: Contract;
    let ownerAddress: string;
    beforeEach(async function () {
      ({ ownerContractConnection, ownerAddress } =
        await reinitializeForArbitraryOwner());
    });

    it("Should set an decreased window if the required number of guardians vote", async function () {
      const newWindow = 50;
      let tx =
        await guardian1ContractConnection.voteForRiskLimitTimeWindowDecrease(
          ownerAddress,
          newWindow
        );
      await tx.wait();
      let currentWindow = await testContract.riskLimitTimeWindow(ownerAddress);
      expect(currentWindow).to.be.equal(BigInt(initialTimeWindow));
      tx = await guardian3ContractConnection.voteForRiskLimitTimeWindowDecrease(
        ownerAddress,
        newWindow
      );
      await tx.wait();
      currentWindow = await testContract.riskLimitTimeWindow(ownerAddress);
      expect(currentWindow).to.be.equal(BigInt(newWindow));
    });

    it("Should allow the owner to increase the time window", async function () {
      const newWindow = 50000;
      let tx = await ownerContractConnection.increaseRiskLimitTimeWindow(
        newWindow
      );
      await tx.wait();
      let currentWindow = await testContract.riskLimitTimeWindow(ownerAddress);
      expect(currentWindow).to.be.equal(BigInt(newWindow));
    });
  });

  describe("Allowances - rejections & non-changes", async function () {
    let ownerContractConnection: Contract;
    let ownerAddress: string;
    before(async function () {
      ({ ownerContractConnection, ownerAddress } =
        await reinitializeForArbitraryOwner());
    });

    it("Should reject a non-guardian call to voteForSpendAllowance", async function () {
      await expect(
        ownerContractConnection.voteForSpendAllowance(
          ownerAddress,
          TOKEN_ADDRESS_1,
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should reject an owner call to set an allowance that applies sooner than a time window away", async function () {
      await expect(
        ownerContractConnection.allowTimeDelayedTransaction(
          ETH_ADDRESS,
          ethers.parseEther("20"),
          // 10s in the future - not a full window
          makeTimestampSecsNow() + 10
        )
      ).to.be.rejectedWith(
        "Transaction is not delayed by a full risk measurement time window"
      );
      await expect(
        ownerContractConnection.allowTimeDelayedTransaction(
          ETH_ADDRESS,
          ethers.parseEther("20"),
          // Definitely in the past
          DEFINITELY_PAST
        )
      ).to.be.rejectedWith(
        "Transaction is not delayed by a full risk measurement time window"
      );
    });

    it("Should reject a guardian call to allowTimeDelayedTransaction - because this call is trying to affect an account for the guardian, which has not been set up", async function () {
      await expect(
        guardian1ContractConnection.allowTimeDelayedTransaction(
          ETH_ADDRESS,
          ethers.parseEther("20"),
          DEFINITELY_FUTURE
        )
      ).to.be.rejectedWith(
        "RiskManager: Risk parameters not initialised for account"
      );
    });

    it("Should not change the limit if the same guardian votes many times", async function () {
      const initialAllowance = await testContract.allowanceAvailable(
        ownerAddress,
        ETH_ADDRESS
      );
      const allowedAmount = ethers.parseEther("20");
      let tx = await guardian1ContractConnection.voteForSpendAllowance(
        ownerAddress,
        ETH_ADDRESS,
        allowedAmount
      );
      await tx.wait();
      let currentAllowance = await testContract.allowanceAvailable(
        ownerAddress,
        ETH_ADDRESS
      );
      expect(currentAllowance).to.be.equal(initialAllowance);
      tx = await guardian1ContractConnection.voteForSpendAllowance(
        ownerAddress,
        ETH_ADDRESS,
        allowedAmount
      );
      await tx.wait();
      currentAllowance = await testContract.allowanceAvailable(
        ownerAddress,
        ETH_ADDRESS
      );
      expect(currentAllowance).to.be.equal(initialAllowance);
    });

    it("Should not change the limit if guardians keep voting for different allowance amounts (per-token)", async function () {
      const initialAllowance = await testContract.allowanceAvailable(
        ownerAddress,
        TOKEN_ADDRESS_2
      );
      let tx = await guardian1ContractConnection.voteForSpendAllowance(
        ownerAddress,
        TOKEN_ADDRESS_2,
        ethers.parseEther("40")
      );
      await tx.wait();
      let currentAllowance = await testContract.allowanceAvailable(
        ownerAddress,
        TOKEN_ADDRESS_2
      );
      expect(currentAllowance).to.be.equal(initialAllowance);
      tx = await guardian2ContractConnection.voteForSpendAllowance(
        ownerAddress,
        TOKEN_ADDRESS_2,
        ethers.parseEther("100")
      );
      await tx.wait();
      // NOTE: although we've had enough votes from different guardians, they're for different values
      currentAllowance = await testContract.allowanceAvailable(
        ownerAddress,
        ETH_ADDRESS
      );
      expect(currentAllowance).to.be.equal(initialAllowance);
    });
  });

  describe("Allowances - successful submissions", async function () {
    let ownerContractConnection: Contract;
    let ownerAddress: string;
    beforeEach(async function () {
      ({ ownerContractConnection, ownerAddress } =
        await reinitializeForArbitraryOwner());
    });

    it("Should add an immediately applicable approval if the required number of guardians vote", async function () {
      let tx = await guardian1ContractConnection.voteForSpendAllowance(
        ownerAddress,
        ETH_ADDRESS,
        ethers.parseEther("20")
      );
      await tx.wait();
      tx = await guardian2ContractConnection.voteForSpendAllowance(
        ownerAddress,
        ETH_ADDRESS,
        ethers.parseEther("20")
      );
      await tx.wait();
      let currentAllowance = await testContract.allowanceAvailable(
        ownerAddress,
        ETH_ADDRESS
      );
      expect(currentAllowance).to.be.equal(ethers.parseEther("20"));
    });

    it("Should allow the owner to pre-approve a transaction above the limit that's at least a full timeWindow in the future", async function () {
      let tx = await ownerContractConnection.allowTimeDelayedTransaction(
        TOKEN_ADDRESS_2,
        ethers.parseEther("20"),
        // Give an extra 10s leeway for processing / drift
        makeTimestampSecsNow() + initialTimeWindow + 10
      );
      await tx.wait();
      let currentAllowance = await testContract.allowanceAvailable(
        ownerAddress,
        TOKEN_ADDRESS_2
      );
      // Allowance shouldn't be available until 1000s later, so currently zero
      expect(currentAllowance).to.be.equal(ethers.parseEther("0"));
    });
  });

  describe("When guardian voting is disable (zero required approvals)", async function () {
    let ownerContractConnection: Contract;
    let ownerAddress: string;

    beforeEach(async function () {
      const ownerWallet = makeArbitraryWallet();
      ownerAddress = ownerWallet.address;
      let tx = await guardianRegistry.setGuardiansFor(ownerAddress, []);
      await tx.wait();
      tx = await testContract.initialiseRiskParams(
        ownerAddress,
        initialTimeWindow,
        serializeBigInt(initialDefaultLimit),
        // 0 votes required
        0
      );
      await tx.wait();
      ownerContractConnection = new Contract(
        contractAddress,
        testContract.interface,
        ownerWallet
      );
      await transferEth(deploymentWallet, ownerWallet.address, "0.02");
    });

    it("Should still allow the owner to allow a time-delayed transaction", async function () {
      let initialAllowance = await testContract.allowanceAvailable(
        ownerAddress,
        ETH_ADDRESS
      );
      await ownerContractConnection.allowTimeDelayedTransaction(
        ETH_ADDRESS,
        ethers.parseEther("20"),
        DEFINITELY_FUTURE
      );
      let currentAllowance = await testContract.allowanceAvailable(
        ownerAddress,
        ETH_ADDRESS
      );
      expect(currentAllowance).to.be.equal(initialAllowance);
    });

    it("Slight weirdness - will not allow owner to vote on a break-glass pre-approval, so they're stuck with the time delay (however with zero guardians required for parameter changes, they can easily set the delay to be zero)", async function () {
      await expect(
        ownerContractConnection.voteForSpendAllowance(
          ownerAddress,
          ETH_ADDRESS,
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith("caller is not a guardian");
    });

    it("Should allow the owner to increase the default limit", async function () {
      const newLimit = ethers.parseEther("20");
      let tx = await ownerContractConnection.increaseDefaultRiskLimit(newLimit);
      await tx.wait();
      let currentLimit = await testContract.defaultRiskLimit(ownerAddress);
      expect(currentLimit).to.be.equal(newLimit);
    });

    it("Should reject a guardian call to increaseDefaultRiskLimit - because this call is trying to affect an account for the guardian, which has not been set up", async function () {
      await expect(
        guardian1ContractConnection.increaseDefaultRiskLimit(
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith(
        "RiskManager: Risk parameters not initialised for account"
      );
    });

    it("Should allow the owner to increase a specific limit", async function () {
      // NOTE: needs to be bigger than what we set the default to
      const newLimit = ethers.parseEther("50");
      let tx = await ownerContractConnection.increaseSpecificRiskLimit(
        TOKEN_ADDRESS_1,
        newLimit
      );
      await tx.wait();
      let currentLimit = await testContract.limitForToken(
        ownerAddress,
        TOKEN_ADDRESS_1
      );
      expect(currentLimit).to.be.equal(newLimit);
    });

    it("Should reject a guardian call to increaseSpecificRiskLimit - because this call is trying to affect an account for the guardian, which has not been set up", async function () {
      await expect(
        guardian1ContractConnection.increaseSpecificRiskLimit(
          TOKEN_ADDRESS_1,
          ethers.parseEther("20")
        )
      ).to.be.rejectedWith(
        "RiskManager: Risk parameters not initialised for account"
      );
    });

    it("Should allow the owner to decrease the time window", async function () {
      const newWindow = 50;
      let tx = await ownerContractConnection.decreaseRiskLimitTimeWindow(
        newWindow
      );
      await tx.wait();
      let currentWindow = await testContract.riskLimitTimeWindow(ownerAddress);
      expect(currentWindow).to.be.equal(BigInt(newWindow));
    });

    it("Should reject a guardian call to decreaseRiskLimitTimeWindow - because this call is trying to affect an account for the guardian, which has not been set up", async function () {
      await expect(
        guardian1ContractConnection.decreaseRiskLimitTimeWindow(4)
      ).to.be.rejectedWith(
        "RiskManager: Risk parameters not initialised for account"
      );
    });
  });
});
