import { expect } from 'chai';
import { Contract, Wallet } from "zksync-ethers";
import { getWallet, deployContract, LOCAL_RICH_WALLETS, sendSmartAccountTransaction } from '../../deploy/utils';
import { SmartAccountDetails, setupUserAccount } from '../../deploy/deploy';
import { ethers, toBigInt } from 'ethers';

describe("MyNFT", function () {
  let nftContract: Contract;
  let ownerWallet: Wallet;
  let recipientDetails: SmartAccountDetails;

  before(async function () {
    ownerWallet = getWallet(LOCAL_RICH_WALLETS[0].privateKey);
    recipientDetails = await setupUserAccount(ownerWallet);

    nftContract = await deployContract(
      "MyNFT",
      ["MyNFTName", "MNFT", "https://mybaseuri.com/token/"],
      { wallet: ownerWallet, silent: true }
    );
  });

  it("Should mint a new NFT to the recipient", async function () {
    const tx = await nftContract.mint(recipientDetails.accountAddress);
    await tx.wait();
    const balance = await nftContract.balanceOf(recipientDetails.accountAddress);
    expect(balance).to.equal(BigInt("1"));
  });


  it("Should allow owner to mint multiple NFTs", async function () {
    const tx1 = await nftContract.mint(recipientDetails.accountAddress);
    await tx1.wait();
    const tx2 = await nftContract.mint(recipientDetails.accountAddress);
    await tx2.wait();
    const balance = await nftContract.balanceOf(recipientDetails.accountAddress);
    expect(balance).to.equal(BigInt("3")); // 1 initial nft + 2 minted
  });

  it("Should allow recipient to transfer their NFTs", async function () {
    const tx = await nftContract.mint(recipientDetails.accountAddress);
    await tx.wait();
    const userBalanceBefore = await nftContract.balanceOf(recipientDetails.accountAddress);

    const abiCoder = new ethers.AbiCoder();
    const toFillOut = nftContract.interface.getFunction("transferFrom(address, address, uint256)");
    const nftContractAddress = await nftContract.getAddress();
    const tokenId = await nftContract.tokenOfOwnerByIndex(recipientDetails.accountAddress, 0);
    
    await sendSmartAccountTransaction(
      recipientDetails,
      ownerWallet.provider,
      {to: nftContractAddress,
        data: ethers.concat([toFillOut!.selector, abiCoder.encode(toFillOut!.inputs, [recipientDetails.accountAddress, ownerWallet.address, tokenId])])
      }
    );


    const userBalanceAfter = await nftContract.balanceOf(recipientDetails.accountAddress);
    expect(userBalanceAfter).to.equal(userBalanceBefore - BigInt("1"));
  });
});
