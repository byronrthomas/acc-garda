import { Wallet } from "zksync-ethers";
import { getWallet } from "../deploy/utils";

export function makeArbitraryWallet(): Wallet {
  return getWallet(Wallet.createRandom().privateKey);
}
