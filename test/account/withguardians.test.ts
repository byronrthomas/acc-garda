import { expect } from "chai";
import { Contract, Wallet } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
} from "../../scripts/utils";

describe("WithGuardians (mix-in)", function () {
  let testContract: Contract;
  let deploymentWallet: Wallet;
  const guardianAddress1: string = "0x1111111111111111111111111111111111111111";
  const guardianAddress2: string = "0x2222222222222222222222222222222222222222";
  const guardianAddress3: string = "0x3333333333333333333333333333333333333333";
  // Add some duplicates just to be sure
  const constructorInputArray = [
    guardianAddress1,
    guardianAddress2,
    guardianAddress3,
    guardianAddress1,
    guardianAddress2,
  ];

  before(async function () {
    deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);

    testContract = await deployContract(
      "WithGuardians",
      [constructorInputArray],
      { wallet: deploymentWallet, silent: true }
    );
  });

  it("Should de-duplicate constructor input addresses", async function () {
    const initialCount = await testContract.guardianCount();
    expect(initialCount).to.equal(BigInt("3"));
  });

  it("All input addresses should be found as guardians", async function () {
    const guardian1Found = await testContract.isGuardian(guardianAddress1);
    expect(guardian1Found).to.be.true;
    const guardian2Found = await testContract.isGuardian(guardianAddress2);
    expect(guardian2Found).to.be.true;
    const guardian3Found = await testContract.isGuardian(guardianAddress3);
    expect(guardian3Found).to.be.true;
  });

  it("Should say that a non-guardian is not a guardian", async function () {
    const nonGuardianAddress = deploymentWallet.address;
    const nonGuardianFound = await testContract.isGuardian(nonGuardianAddress);
    expect(nonGuardianFound).to.be.false;
  });

  it("Should be possible to fetch out all of the guardian addresses", async function () {
    const guardianPresent: boolean[] = [false, false, false];
    const guardianCount = await testContract.guardianCount();
    for (let i = 0; i < guardianCount; i++) {
      const guardianAddress = await testContract.guardianAtIndex(i);
      if (guardianAddress === guardianAddress1) {
        guardianPresent[0] = true;
      } else if (guardianAddress === guardianAddress2) {
        guardianPresent[1] = true;
      } else if (guardianAddress === guardianAddress3) {
        guardianPresent[2] = true;
      }
    }
    expect(guardianPresent[0]).to.be.true;
    expect(guardianPresent[1]).to.be.true;
    expect(guardianPresent[2]).to.be.true;
  });
});
