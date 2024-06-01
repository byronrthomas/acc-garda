import { getWallet } from "./utils";
import { ethers } from "ethers";

async function checkGasPrice() {
  const wallet = getWallet();
  const gasPrice = await wallet.provider.getGasPrice();
  console.log(
    `Current gas price: ${gasPrice.toString()} - ${ethers.formatUnits(
      gasPrice,
      "gwei"
    )} gwei`
  );
}

checkGasPrice();

// gasPrice was 184575887 when I checked around the failure time
// seems to change fairly quickly (every minute or so)
