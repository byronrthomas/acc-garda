import chai from "chai";
import chaiAsPromised from "chai-as-promised";
chai.use(chaiAsPromised);
const { expect } = chai;
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

describe("PaymasterForGuardians (mix-in)", function () {
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
      // Use the ERC-20 as the guarded address - unless you're interacting
      // with the ERC-20, the contract under test won't pay the fees
      [constructorInputArray, [targetContractAddress]],
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
    // e.g. guardian1 transfers ETH to guardian2 but supplies paymaster params
    // Fund guardian1 with some ETH so that only the paymaster would block the transaction
    await transferEth(deploymentWallet, guardianWallet1.address, "0.02");
    await expect(
      guardianWallet1.sendTransaction({
        to: guardianWallet2.address,
        value: ethers.parseEther("0.001"),
        ...additionalTxParams,
      })
    ).to.be.rejectedWith(
      "Won't pay fees: Recipient of transaction is not an allowed recipient"
    );
  });

  it("Should NOT pay fees on behalf of a non-guardian interacting with the guarded account", async function () {
    // e.g. deployment wallet sending ERC-20 token to guardian, supplying paymaster params
    await expect(
      targetContract.transfer(
        testContractAddress,
        ethers.parseEther("1"),
        additionalTxParams
      )
    ).to.be.rejectedWith(
      "Won't pay fees: Sender of transaction is not a guardian"
    );
  });

  it("Should NOT pay fees on behalf of a non-guardian interacting with some other account", async function () {
    // e.g. deployment wallet sending ETH to guardian1 but supplies paymaster params
    await expect(
      deploymentWallet.sendTransaction({
        to: guardianWallet2.address,
        value: ethers.parseEther("0.001"),
        ...additionalTxParams,
      })
    ).to.be.rejectedWith(
      "Won't pay fees: Recipient of transaction is not an allowed recipient"
    );
  });
});
