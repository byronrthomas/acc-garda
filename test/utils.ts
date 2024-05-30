import { Wallet } from "zksync-ethers";
import { getWallet } from "../scripts/utils";

export function makeArbitraryWallet(): Wallet {
  return getWallet(Wallet.createRandom().privateKey);
}

export const serializeBigInt = (value: bigint) => {
  return "0x" + value.toString(16);
};
