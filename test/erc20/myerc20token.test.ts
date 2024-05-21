import { expect } from 'chai';
import { Contract, EIP712Signer, Provider, SmartAccount, Wallet, types, utils } from "zksync-ethers";
import { getWallet, deployContract, LOCAL_RICH_WALLETS } from '../../deploy/utils';
import * as ethers from "ethers";
import { setupUserAccount, SmartAccountDetails } from '../../deploy/deploy';


describe("MyERC20Token", function () {
  let tokenContract: Contract;
  let ownerWallet: Wallet;
  let userAccountDetails: SmartAccountDetails;
  let userAccount : SmartAccount;

  before(async function () {
    ownerWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    
    userAccountDetails = await setupUserAccount(ownerWallet);
    userAccount = new SmartAccount({ address: userAccountDetails.accountAddress, secret: userAccountDetails.ownerPrivateKey }, ownerWallet.provider);

    tokenContract = await deployContract("MyERC20Token", [], { wallet: ownerWallet, silent: true });
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
    const tx = await tokenContract.transfer(userAccountDetails.accountAddress, transferAmount);
    await tx.wait();
    const userBalance = await tokenContract.balanceOf(userAccountDetails.accountAddress);
    expect(userBalance).to.equal(transferAmount);

    const abiCoder = new ethers.AbiCoder();
    const toFillOut = tokenContract.interface.getFunction("transfer(address, uint256)");
    const tokenContractAddress = await tokenContract.getAddress();
    
    await sendSmartAccountTransaction(
      userAccountDetails,
      ownerWallet.provider,
      {to: tokenContractAddress,
        data: ethers.concat([toFillOut!.selector, abiCoder.encode(toFillOut!.inputs, [ownerWallet.address, transferAmount])])
      }
    );

    // NOTE: I couldn't make this kind of pattern work:
    // const userTokenContract = new Contract(await tokenContract.getAddress(), tokenContract.interface, userAccount);
    // const tx2 = await userTokenContract.transfer(ownerWallet.address, transferAmount);
    // await tx2.wait();

    const userBalanceAfter = await tokenContract.balanceOf(userAccountDetails.accountAddress);
    expect(userBalanceAfter).to.equal(ethers.toBigInt(0));
  });

  it("Smart account can burn the tokens that they have", async function () {
    const transferAmount = ethers.parseEther("50"); // Transfer 50 tokens
    const tx = await tokenContract.transfer(userAccountDetails.accountAddress, transferAmount);
    await tx.wait();

    // Try to burn 10 tokens
    const burnAmount = ethers.parseEther("10");
    const abiCoder = new ethers.AbiCoder();
    const toFillOut = tokenContract.interface.getFunction("burn(uint256)");
    const tokenContractAddress = await tokenContract.getAddress();


    await sendSmartAccountTransaction(
      userAccountDetails,
      ownerWallet.provider,
      {to: tokenContractAddress,
        data: ethers.concat([toFillOut!.selector, abiCoder.encode(toFillOut!.inputs, [burnAmount])])
      }
    );

    const userBalanceAfter = await tokenContract.balanceOf(userAccountDetails.accountAddress);
    expect(userBalanceAfter).to.be.equal(transferAmount - burnAmount);

  });
});

type SmartAccountTransactionLike = {
  /**
   * Must supply an address to send the transaction to
   */
  to: string
  /**
   * Optionally can supply ETH value
   */
  value?: bigint
  /**
   * Optionally can supply data
   */
  data?: string
}
async function sendSmartAccountTransaction(details: SmartAccountDetails, provider: Provider, txToFill: SmartAccountTransactionLike) {
  const accountOwner = new Wallet(details.ownerPrivateKey, provider);
  let ethTransferTx = {
    from: details.accountAddress,
    chainId: (await provider.getNetwork()).chainId,
    nonce: await provider.getTransactionCount(details.accountAddress),
    type: 113,
    customData: {
      gasPerPubdata: utils.DEFAULT_GAS_PER_PUBDATA_LIMIT,
    } as types.Eip712Meta,

    gasPrice: await provider.getGasPrice(),
    gasLimit: BigInt(20000000), // constant 20M since estimateGas() causes an error and this tx consumes more than 15M at most
    ...txToFill
  };
  const signedTxHash = EIP712Signer.getSignedDigest(ethTransferTx);
  const signature = ethers.concat([ethers.Signature.from(accountOwner.signingKey.sign(signedTxHash)).serialized]);

  ethTransferTx.customData = {
    ...ethTransferTx.customData,
    customSignature: signature,
  };

    // make the call
  console.log("Sending transaction from smart contract account");
  const sentTx = await provider.broadcastTransaction(types.Transaction.from(ethTransferTx).serialized);
  await sentTx.wait();
  console.log(`Smart account tx hash is ${sentTx.hash}`);
}