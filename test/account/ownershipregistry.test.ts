import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const { expect } = chai;
import { Contract, Wallet } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
  transferEth,
} from "../../scripts/utils";
import { makeArbitraryWallet } from "../utils";
import { ethers } from "ethers";
import { test } from "mocha";

describe("OwnershipRegistry standalone", function () {
  let testContract: Contract;
  const testAccountAddress: string = makeArbitraryWallet().address;
  let guardianRegistry: Contract;
  let guardianRegistryAddress: string;
  let guardian1ContractConnection: Contract;
  let guardian2ContractConnection: Contract;
  let guardian3ContractConnection: Contract;
  let guardian4ContractConnection: Contract;
  let guardian5ContractConnection: Contract;
  let deploymentWallet: Wallet;
  const guardianWallet1: Wallet = makeArbitraryWallet();
  const guardianWallet2: Wallet = makeArbitraryWallet();
  const guardianWallet3: Wallet = makeArbitraryWallet();
  const guardianWallet4: Wallet = makeArbitraryWallet();
  const guardianWallet5: Wallet = makeArbitraryWallet();
  const proposedOwnerAddress = "0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF";
  const testDisplayName = "The One and Only!";
  const testOwnerAddress = LOCAL_RICH_WALLETS[5].address;
  // Add some duplicates just to be sure
  const guardiansArray = [
    guardianWallet1.address,
    guardianWallet2.address,
    guardianWallet3.address,
    guardianWallet4.address,
    guardianWallet5.address,
  ];

  before(async function () {
    deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    guardianRegistry = await deployContract("GuardianRegistry", [], {
      wallet: deploymentWallet,
      silent: true,
    });
    guardianRegistryAddress = await guardianRegistry.getAddress();
    const tx = await guardianRegistry.setGuardiansFor(
      testAccountAddress,
      guardiansArray
    );
    await tx.wait();

    // Ensure all the guardians can pay their own fees
    const balance = await deploymentWallet.provider.getBalance(
      deploymentWallet.address
    );
    // console.log(`Deployment wallet balance: ${balance}`);
    await transferEth(deploymentWallet, guardianWallet1.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet2.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet3.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet4.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet5.address, "0.02");
  });

  beforeEach(async function () {
    testContract = await deployContract(
      "OwnershipRegistry",
      // Let's do a 3 of 5 approval mechanism
      [guardianRegistryAddress],
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
    guardian4ContractConnection = new Contract(
      contractAddress,
      testContract.interface,
      guardianWallet4
    );
    guardian5ContractConnection = new Contract(
      contractAddress,
      testContract.interface,
      guardianWallet5
    );
    // Set the initial owner for the test
    const initialTx = await testContract.setInitialOwner(
      testAccountAddress,
      testOwnerAddress,
      3,
      testDisplayName
    );
    await initialTx.wait();
  });

  it("Should initially have no votes", async function () {
    const initialCount = await testContract.getVotesForProposedOwner(
      testAccountAddress
    );
    expect(initialCount).to.equal(BigInt("0"));
  });

  it("Should have the correct display name", async function () {
    const displayName = await testContract.accountOwnerDisplayName(
      testAccountAddress
    );
    expect(displayName).to.equal(testDisplayName);
  });

  it("Should have the initial owner address at first", async function () {
    const initialOwner = await testContract.accountOwner(testAccountAddress);
    expect(initialOwner).to.equal(testOwnerAddress);
  });

  it("Should reject a vote from somebody that isn't a guardian", async function () {
    await expect(
      testContract.voteForNewOwner(testAccountAddress, proposedOwnerAddress)
    ).to.be.rejectedWith("Only guardian can call this method");
  });

  it("Should reject another call to setInitialOwner", async function () {
    await expect(
      testContract.setInitialOwner(
        testAccountAddress,
        proposedOwnerAddress,
        3,
        testDisplayName
      )
    ).to.be.rejectedWith(
      "Owner already set for account - needs guardian voting to change it"
    );
  });

  it("Should not change the owner when not enough votes are received", async function () {
    let tx = await guardian1ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    let currentOwner = await testContract.accountOwner(testAccountAddress);
    expect(currentOwner).to.equal(testOwnerAddress);
    tx = await guardian2ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    currentOwner = await testContract.accountOwner(testAccountAddress);
    expect(currentOwner).to.equal(testOwnerAddress);
  });

  it("Should only increment the vote count when a fresh vote is received for same proposal", async function () {
    let tx = await guardian1ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    let voteCount = await testContract.getVotesForProposedOwner(
      testAccountAddress
    );
    expect(voteCount).to.equal(BigInt("1"));
    tx = await guardian1ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    voteCount = await testContract.getVotesForProposedOwner(testAccountAddress);
    expect(voteCount).to.equal(BigInt("1"));
    tx = await guardian2ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    voteCount = await testContract.getVotesForProposedOwner(testAccountAddress);
    expect(voteCount).to.equal(BigInt("2"));
  });

  it("Should change the owner when enough votes are received", async function () {
    let tx = await guardian4ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    tx = await guardian5ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    tx = await guardian3ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    let currentOwner = await testContract.accountOwner(testAccountAddress);
    expect(currentOwner).to.equal(proposedOwnerAddress);
    // Display name doesn't change just because owner address does
    const displayName = await testContract.accountOwnerDisplayName(
      testAccountAddress
    );
    expect(displayName).to.equal(testDisplayName);
  });

  it("Should reset the count of votes after a successful owner change", async function () {
    let tx = await guardian4ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    let voteCount = await testContract.getVotesForProposedOwner(
      testAccountAddress
    );
    expect(voteCount).to.equal(BigInt("1"));
    tx = await guardian5ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    voteCount = await testContract.getVotesForProposedOwner(testAccountAddress);
    expect(voteCount).to.equal(BigInt("2"));
    tx = await guardian3ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    voteCount = await testContract.getVotesForProposedOwner(testAccountAddress);
    expect(voteCount).to.equal(BigInt("0"));
  });

  it("Should reset the count of votes if the proposed owner changes between votes", async function () {
    let tx = await guardian4ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    tx = await guardian3ContractConnection.voteForNewOwner(
      testAccountAddress,
      guardianWallet4.address
    );
    await tx.wait();
    let voteCount = await testContract.getVotesForProposedOwner(
      testAccountAddress
    );
    expect(voteCount).to.equal(BigInt("1"));
    tx = await guardian5ContractConnection.voteForNewOwner(
      testAccountAddress,
      proposedOwnerAddress
    );
    await tx.wait();
    voteCount = await testContract.getVotesForProposedOwner(testAccountAddress);
    expect(voteCount).to.equal(BigInt("1"));
  });

  it("Should return the owner of the caller for getOwner", async function () {
    const owner = await testContract.getOwner();
    // No owner initially set for deployment address
    expect(owner).to.equal(ethers.ZeroAddress);
    const tx = await guardian1ContractConnection.setInitialOwner(
      deploymentWallet.address,
      guardianWallet1.address,
      0,
      "A.N. Other"
    );
    await tx.wait();
    const newOwner = await testContract.getOwner();
    expect(newOwner).to.equal(guardianWallet1.address);
    const ownerDisplay = await testContract.getOwnerDisplayName();
    expect(ownerDisplay).to.equal("A.N. Other");
  });

  it("Should function as a non-changeable initial owner if no guardians are present", async function () {
    const noGuardiansAddress = makeArbitraryWallet().address;
    expect(
      await guardianRegistry.getGuardianCountFor(noGuardiansAddress)
    ).to.be.equal(BigInt(0));
    const tx = await testContract.setInitialOwner(
      noGuardiansAddress,
      testOwnerAddress,
      0,
      testDisplayName
    );
    await tx.wait();

    // Leave as no guardians (should be default state on guardian registry)
    let currentOwner = await testContract.accountOwner(noGuardiansAddress);
    expect(currentOwner).to.equal(testOwnerAddress);
    const proposedOwner = guardianWallet1.address;
    await expect(
      guardian1ContractConnection.voteForNewOwner(
        noGuardiansAddress,
        proposedOwner
      )
    ).to.be.rejectedWith("Only guardian can call this method");
    currentOwner = await testContract.accountOwner(noGuardiansAddress);
    expect(currentOwner).to.equal(testOwnerAddress);
    await expect(
      testContract.setInitialOwner(
        noGuardiansAddress,
        proposedOwner,
        0,
        testDisplayName
      )
    ).to.be.rejectedWith(
      "Owner already set for account - needs guardian voting to change it"
    );
  });
});
