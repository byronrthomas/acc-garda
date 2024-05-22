import { expect } from "chai";
import { Contract, Wallet } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
} from "../../deploy/utils";
import { ethers } from "ethers";
import { transferEth } from "../../deploy/deploy";

function makeArbitraryWallet(): Wallet {
  return getWallet(Wallet.createRandom().privateKey);
}

describe("WithGuardians (mix-in)", function () {
  let testContract: Contract;
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
  const constructorInputArray = [
    guardianWallet1.address,
    guardianWallet2.address,
    guardianWallet3.address,
    guardianWallet4.address,
    guardianWallet5.address,
  ];

  before(async function () {
    deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    // Ensure all the guardians can pay their own fees
    const balance = await deploymentWallet.provider.getBalance(
      deploymentWallet.address
    );
    console.log(`Deployment wallet balance: ${balance}`);
    await transferEth(deploymentWallet, guardianWallet1.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet2.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet3.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet4.address, "0.02");
    await transferEth(deploymentWallet, guardianWallet5.address, "0.02");
  });

  beforeEach(async function () {
    testContract = await deployContract(
      "GuardedOwnership",
      // Let's do a 3 of 5 approval mechanism
      [testOwnerAddress, constructorInputArray, 3, testDisplayName],
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
  });

  it("Should initially have no votes", async function () {
    const initialCount = await testContract.getVotesForProposedOwner();
    expect(initialCount).to.equal(BigInt("0"));
  });

  it("Should have the correct display name", async function () {
    const displayName = await testContract.ownerDisplayName();
    expect(displayName).to.equal(testDisplayName);
  });

  it("Should have the initial owner address at first", async function () {
    const initialOwner = await testContract.owner();
    expect(initialOwner).to.equal(testOwnerAddress);
  });

  it("Should reject a vote from somebody that isn't the owner", async function () {
    try {
      await testContract.voteForNewOwner(proposedOwnerAddress);
    } catch (e) {
      expect(e.message).to.contain("Only guardian can call this method");
    }
  });

  it("Should not change the owner when not enough votes are received", async function () {
    let tx = await guardian1ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    let currentOwner = await testContract.owner();
    expect(currentOwner).to.equal(testOwnerAddress);
    tx = await guardian2ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    currentOwner = await testContract.owner();
    expect(currentOwner).to.equal(testOwnerAddress);
  });

  it("Should only increment the vote count when a fresh vote is received for same proposal", async function () {
    let tx = await guardian1ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    let voteCount = await testContract.getVotesForProposedOwner();
    expect(voteCount).to.equal(BigInt("1"));
    tx = await guardian1ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    voteCount = await testContract.getVotesForProposedOwner();
    expect(voteCount).to.equal(BigInt("1"));
    tx = await guardian2ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    voteCount = await testContract.getVotesForProposedOwner();
    expect(voteCount).to.equal(BigInt("2"));
  });

  it("Should change the owner when enough votes are received", async function () {
    let tx = await guardian4ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    tx = await guardian5ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    tx = await guardian3ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    let currentOwner = await testContract.owner();
    expect(currentOwner).to.equal(proposedOwnerAddress);
    // Display name doesn't change just because owner address does
    const displayName = await testContract.ownerDisplayName();
    expect(displayName).to.equal(testDisplayName);
  });

  it("Should reset the count of votes after a successful owner change", async function () {
    let tx = await guardian4ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    let voteCount = await testContract.getVotesForProposedOwner();
    expect(voteCount).to.equal(BigInt("1"));
    tx = await guardian5ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    voteCount = await testContract.getVotesForProposedOwner();
    expect(voteCount).to.equal(BigInt("2"));
    tx = await guardian3ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    voteCount = await testContract.getVotesForProposedOwner();
    expect(voteCount).to.equal(BigInt("0"));
  });

  it("Should reset the count of votes if the proposed owner changes between votes", async function () {
    let tx = await guardian4ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    tx = await guardian3ContractConnection.voteForNewOwner(
      guardianWallet4.address
    );
    await tx.wait();
    let voteCount = await testContract.getVotesForProposedOwner();
    expect(voteCount).to.equal(BigInt("1"));
    tx = await guardian5ContractConnection.voteForNewOwner(
      proposedOwnerAddress
    );
    await tx.wait();
    voteCount = await testContract.getVotesForProposedOwner();
    expect(voteCount).to.equal(BigInt("1"));
  });

  it("Should function as a contract that cannot change owner if no guardians are present", async function () {
    const noGuardiansContract = await deployContract(
      "GuardedOwnership",
      [testOwnerAddress, [], 0, testDisplayName],
      { wallet: deploymentWallet, silent: true }
    );
    let currentOwner = await noGuardiansContract.owner();
    expect(currentOwner).to.equal(testOwnerAddress);
    const proposedOwner = guardianWallet1.address;
    try {
      await noGuardiansContract.voteForNewOwner(proposedOwner);
    } catch (e) {
      expect(e.message).to.contain("Only guardian can call this method");
    }
    currentOwner = await noGuardiansContract.owner();
    expect(currentOwner).to.equal(testOwnerAddress);
  });
});
