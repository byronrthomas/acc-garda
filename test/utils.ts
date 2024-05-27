import { Wallet } from "zksync-ethers";
import { getWallet } from "../scripts/utils";

export function makeArbitraryWallet(): Wallet {
  return getWallet(Wallet.createRandom().privateKey);
}
