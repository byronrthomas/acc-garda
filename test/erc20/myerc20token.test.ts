import { expect } from "chai";
import { Contract, Provider, Wallet } from "zksync-ethers";
import {
  getWallet,
  deployContract,
  LOCAL_RICH_WALLETS,
  sendSmartAccountTransaction,
} from "../../scripts/utils";
import * as ethers from "ethers";
import {
  setupUserAccountForTest,
  SmartAccountDetails,
} from "../../deploy/deploy";

describe("MyERC20Token", function () {
  let tokenContract: Contract;
  let deploymentWallet: Wallet;
  let userAccountDetails: SmartAccountDetails;

  before(async function () {
    deploymentWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);

    userAccountDetails = await setupUserAccountForTest(deploymentWallet, {
      guardianAddresses: [],
      guardianApprovalThreshold: 0,
      displayName: "Test Account",
    });

    tokenContract = await deployContract("MyERC20Token", [], {
      wallet: deploymentWallet,
      silent: true,
    });
  });

  it("Should have correct initial supply", async function () {
    const initialSupply = await tokenContract.totalSupply();
    expect(initialSupply).to.equal(BigInt("1000000000000000000000000")); // 1 million tokens with 18 decimals
  });

  it("Should allow owner to burn tokens", async function () {
    const burnAmount = ethers.parseEther("10"); // Burn 10 tokens
    const tx = await tokenContract.burn(burnAmount);
    await tx.wait();
    const afterBurnSupply = await tokenContract.totalSupply();
    expect(afterBurnSupply).to.equal(BigInt("999990000000000000000000")); // 999,990 tokens remaining
  });

  it("Should allow user to transfer tokens to smart account and back", async function () {
    const transferAmount = ethers.parseEther("50"); // Transfer 50 tokens
    const tx = await tokenContract.transfer(
      userAccountDetails.accountAddress,
      transferAmount
    );
    await tx.wait();
    const userBalance = await tokenContract.balanceOf(
      userAccountDetails.accountAddress
    );
    expect(userBalance).to.equal(transferAmount);

    await transferTokenFromUserAccount(
      tokenContract,
      deploymentWallet.provider,
      userAccountDetails,
      deploymentWallet.address,
      transferAmount
    );

    // NOTE: I couldn't make this kind of pattern work:
    // const userTokenContract = new Contract(await tokenContract.getAddress(), tokenContract.interface, userAccount);
    // const tx2 = await userTokenContract.transfer(deploymentWallet.address, transferAmount);
    // await tx2.wait();

    const userBalanceAfter = await tokenContract.balanceOf(
      userAccountDetails.accountAddress
    );
    expect(userBalanceAfter).to.equal(ethers.toBigInt(0));
  });

  it("Smart account can burn the tokens that they have", async function () {
    const transferAmount = ethers.parseEther("50"); // Transfer 50 tokens
    const tx = await tokenContract.transfer(
      userAccountDetails.accountAddress,
      transferAmount
    );
    await tx.wait();

    // Try to burn 10 tokens
    const burnAmount = ethers.parseEther("10");
    const abiCoder = new ethers.AbiCoder();
    const toFillOut = tokenContract.interface.getFunction("burn(uint256)");
    const tokenContractAddress = await tokenContract.getAddress();

    await sendSmartAccountTransaction(
      userAccountDetails,
      deploymentWallet.provider,
      {
        to: tokenContractAddress,
        data: ethers.concat([
          toFillOut!.selector,
          abiCoder.encode(toFillOut!.inputs, [burnAmount]),
        ]),
      }
    );

    const userBalanceAfter = await tokenContract.balanceOf(
      userAccountDetails.accountAddress
    );
    expect(userBalanceAfter).to.be.equal(transferAmount - burnAmount);
  });
});

export async function transferTokenFromUserAccount(
  tokenContract: Contract,
  provider: Provider,
  userAccountDetails: SmartAccountDetails,
  toAddress: string,
  transferAmount: ethers.BigNumberish
) {
  const abiCoder = new ethers.AbiCoder();
  const toFillOut = tokenContract.interface.getFunction(
    "transfer(address, uint256)"
  );
  const tokenContractAddress = await tokenContract.getAddress();

  await sendSmartAccountTransaction(userAccountDetails, provider, {
    to: tokenContractAddress,
    data: ethers.concat([
      toFillOut!.selector,
      abiCoder.encode(toFillOut!.inputs, [toAddress, transferAmount]),
    ]),
  });
}
