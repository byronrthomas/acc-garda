import { getWallet, transferEth } from "./utils";

async function normalTransfer() {
  const fromPk = process.env.WALLET_PRIVATE_KEY;
  const toAddress = process.env.TO_ADDRESS;
  const amount = process.env.AMOUNT;
  if (!fromPk) {
    throw "⛔️ Wallet private key wasn't found in .env file!";
  }
  if (!toAddress || !amount) {
    throw "⛔️ TO_ADDRESS or AMOUNT environment variable wasn't found!";
  }
  const wallet = getWallet(fromPk);
  console.log(
    `Transferring ${amount} ETH from ${wallet.address} to ${toAddress}`
  );
  await transferEth(wallet, toAddress, amount);
}

normalTransfer();
