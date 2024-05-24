import { expect } from "chai";
import { Contract, Wallet, utils } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
} from "../../deploy/utils";
import { makeArbitraryWallet } from "../utils";
import { transferEth } from "../../deploy/deploy";
import { ethers } from "ethers";
import { PaymasterParams } from "zksync-ethers/build/types";

describe("WithGuardians (mix-in)", function () {
  let testContract: Contract;
  let targetContract: Contract;
  let testContractAddress: string;
  let targetContractAddress: string;
  let gasPrice: bigint;
  let paymasterParams: PaymasterParams;
  let additionalTxParams: any;
  let deploymentWallet: Wallet;
  const guardianWallet1: Wallet = makeArbitraryWallet();
  const guardianWallet2: Wallet = makeArbitraryWallet();
  // Add some duplicates just to be sure
  const constructorInputArray = [
    guardianWallet1.address,
    guardianWallet2.address,
  ];

  before(async function () {
    deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    gasPrice = await deploymentWallet.provider.getGasPrice();
    // Deploy an ERC20 token that we will use as another contract
    // that the guardians will interact with
    targetContract = await deployContract("MyERC20Token", [], {
      wallet: deploymentWallet,
      silent: true,
    });
    targetContractAddress = await targetContract.getAddress();
    testContract = await deployContract(
      "TestPaymasterForGuardians",
      // Let's do a 3 of 5 approval mechanism
      [constructorInputArray, targetContractAddress],
      { wallet: deploymentWallet, silent: true }
    );
    testContractAddress = await testContract.getAddress();
    paymasterParams = utils.getPaymasterParams(testContractAddress, {
      type: "General",
      innerInput: new Uint8Array(),
    });
    additionalTxParams = {
      maxPriorityFeePerGas: BigInt(0),
      maxFeePerGas: gasPrice,
      gasLimit: 6000000,
      customData: {
        gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
        paymasterParams,
      },
    };

    // Send ETH to the paymaster contract so that it can pay fees
    await transferEth(deploymentWallet, testContractAddress, "0.02");
    // Send an ERC token to one of the guardian's so that it has something
    // to interact with that contract
    const tx = await targetContract.transfer(
      guardianWallet2.address,
      ethers.parseEther("10")
    );
    await tx.wait();
  });

  it("Should pay fees on behalf of a guardian interacting with the guarded account", async function () {
    const guardianBalanceBefore = await guardianWallet2.getBalance();
    console.log("Guardian balance before: ", guardianBalanceBefore.toString());

    const guardianConnect = targetContract.connect(guardianWallet2);
    // @ts-ignore
    const tx = await guardianConnect.transfer(
      testContractAddress,
      ethers.parseEther("1"),
      additionalTxParams
    );
    await tx.wait();

    const guardianBalanceAfter = await guardianWallet2.getBalance();
    console.log("Guardian balance after: ", guardianBalanceAfter.toString());
    expect(guardianBalanceAfter).to.be.equal(guardianBalanceBefore);
  });

  it("Should NOT pay fees on behalf of a guardian interacting with some other account", async function () {
    // e.g. guardian1 transfers ETH to guardian2 but supplies guardian params
    // Fund guardian1 with some ETH so that only the paymaster would block the transaction
    await transferEth(deploymentWallet, guardianWallet1.address, "0.02");
    // Now check for a reject from the paymaster:
    let failed = false;
    try {
      const tx = await guardianWallet1.sendTransaction({
        to: guardianWallet2.address,
        value: ethers.parseEther("0.001"),
        ...additionalTxParams,
      });
      await tx.wait();
    } catch (e) {
      failed = true;
      //console.log("Transaction failed as expected: ", e);
      expect(e.message).to.contain(
        "Won't pay fees: Recipient of transaction is not the guarded address"
      );
    }
    expect(failed, "Transaction should have failed").to.be.true;
  });

  it("Should NOT pay fees on behalf of a non-guardian interacting with the guarded account", async function () {
    // e.g. deployment wallet sending ERC-20 token to guardian, supplying guardian params
    let failed = false;
    try {
      const tx = await targetContract.transfer(
        guardianWallet1.address,
        ethers.parseEther("1"),
        additionalTxParams
      );
      await tx.wait();
    } catch (e) {
      failed = true;
      //console.log("Transaction failed as expected: ", e);
      expect(e.message).to.contain(
        "Won't pay fees: Sender of transaction is not a guardian"
      );
    }
    expect(failed, "Transaction should have failed").to.be.true;
  });

  it("Should NOT pay fees on behalf of a non-guardian interacting with some other account", async function () {
    // e.g. deployment wallet sending ETH to guardian1 but supplies guardian params
    let failed = false;
    try {
      const tx = await deploymentWallet.sendTransaction({
        to: guardianWallet2.address,
        value: ethers.parseEther("0.001"),
        ...additionalTxParams,
      });
      await tx.wait();
    } catch (e) {
      failed = true;
      //console.log("Transaction failed as expected: ", e);
      expect(e.message).to.contain(
        "Won't pay fees: Recipient of transaction is not the guarded address"
      );
    }
    expect(failed, "Transaction should have failed").to.be.true;
  });
});
