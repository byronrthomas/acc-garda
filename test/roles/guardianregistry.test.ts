import { Contract, Wallet, utils } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
} from "../../scripts/utils";
import { makeArbitraryWallet } from "../utils";
import { ethers } from "ethers";
import chai from "chai";
import chaiAsPromised from "chai-as-promised";

chai.use(chaiAsPromised);
const { expect } = chai;

describe("GuardianRegistry", function () {
  let wallet: Wallet;
  let guardianRegistry: Contract;
  // Make an arbitrary address to test with
  const guardianTestAddress1 = makeArbitraryWallet().address;
  const guardianTestAddress2 = makeArbitraryWallet().address;
  const guardianTestAddress3 = makeArbitraryWallet().address;

  before(async () => {
    wallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    guardianRegistry = await deployContract("GuardianRegistry", [], {
      wallet,
      silent: true,
    });
  });

  it("should allow anybody to initially set guardians for an address", async () => {
    const testAddress = ethers.Wallet.createRandom().address;
    const tx = await guardianRegistry.setGuardiansFor(testAddress, [
      guardianTestAddress1,
      guardianTestAddress2,
    ]);
    await tx.wait();
  });

  describe("after guardians are set for a test address", () => {
    const testAddress = ethers.Wallet.createRandom().address;
    const guardiansToCheck = [guardianTestAddress1, guardianTestAddress3];
    before(async () => {
      const tx = await guardianRegistry.setGuardiansFor(
        testAddress,
        guardiansToCheck
      );
      await tx.wait();
    });

    it("Should say that a guardian is a guardian", async () => {
      expect(
        await guardianRegistry.isGuardianFor(testAddress, guardianTestAddress1)
      ).to.be.true;
      expect(
        await guardianRegistry.isGuardianFor(testAddress, guardianTestAddress3)
      ).to.be.true;
    });

    it("Should return the correct list of guardians (in any order)", async () => {
      const guardians = await guardianRegistry.getGuardiansFor(testAddress);
      expect([...guardians]).to.have.members([...guardiansToCheck]);
    });

    it("Should say that a non-guardian is not a guardian", async () => {
      expect(
        await guardianRegistry.isGuardianFor(testAddress, guardianTestAddress2)
      ).to.be.false;
    });

    it("Should not allow another call to set the guardians from an address that isn't the test address", async () => {
      await expect(
        guardianRegistry.setGuardiansFor(testAddress, [guardianTestAddress2])
      ).to.be.rejectedWith(
        "Only the guarded address can change it's guardians"
      );
    });

    it("Should return no guardians for any other address", async () => {
      expect(
        await guardianRegistry.getGuardiansFor(wallet.address)
      ).to.deep.equal([]);
    });
  });

  describe("Can be used from another contract to control it's own guardians", () => {
    describe("Contract is in full control of it's own guardians", () => {
      let testContract: Contract;
      let testContractAddress: string;

      before(async () => {
        const guardianRegistryAddress = await guardianRegistry.getAddress();
        testContract = await deployContract(
          "TestGuardianRegistry",
          [guardianRegistryAddress],
          {
            wallet,
            silent: true,
          }
        );
        testContractAddress = await testContract.getAddress();
      });
      it("Should allow the contract to set it's own guardians", async () => {
        const tx = await testContract.setGuardians([guardianTestAddress3]);
        await tx.wait();
      });
    });

    describe("After it has set guardians", () => {
      let testContract: Contract;
      let testContractAddress: string;

      before(async () => {
        const guardianRegistryAddress = await guardianRegistry.getAddress();
        testContract = await deployContract(
          "TestGuardianRegistry",
          [guardianRegistryAddress],
          {
            wallet,
            silent: true,
          }
        );
        testContractAddress = await testContract.getAddress();
        const tx = await testContract.setGuardians([
          guardianTestAddress1,
          guardianTestAddress2,
        ]);
        await tx.wait();
      });

      it("Should allow the contract to check if a guardian is a guardian", async () => {
        expect(await testContract.isGuardian(guardianTestAddress1)).to.be.true;
        expect(await testContract.isGuardian(guardianTestAddress2)).to.be.true;
      });

      it("Should allow the contract to check if a non-guardian is not a guardian", async () => {
        expect(await testContract.isGuardian(guardianTestAddress3)).to.be.false;
      });

      it("Should allow the contract to get the guardians", async () => {
        const guardians = await testContract.getGuardians();
        const directGuardians = await guardianRegistry.getGuardiansFor(
          testContractAddress
        );
        expect([...guardians]).to.have.members([
          guardianTestAddress1,
          guardianTestAddress2,
        ]);
      });

      it("Should not allow any other address to try and directly set guardians via the registry", async () => {
        await expect(
          guardianRegistry.setGuardiansFor(testContractAddress, [
            guardianTestAddress3,
          ])
        ).to.be.rejectedWith(
          "Only the guarded address can change it's guardians"
        );
      });
    });
  });
});
