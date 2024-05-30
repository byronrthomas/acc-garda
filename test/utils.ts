import { Wallet } from "zksync-ethers";
import { getWallet } from "../scripts/utils";

export function makeArbitraryWallet(): Wallet {
  return getWallet(Wallet.createRandom().privateKey);
}

export const serializeBigInt = (value: bigint) => {
  return "0x" + value.toString(16);
};

export function sleepUntil(finalTimeMs) {
  const timeToSleep = finalTimeMs - Date.now();
  if (timeToSleep > 0) {
    console.log("Going to wait for ", timeToSleep, "ms");
    return new Promise((resolve) => setTimeout(resolve, timeToSleep));
  } else {
    console.log("Time already passed, no need to sleep");
    return Promise.resolve();
  }
}

export function makeTimestampSecs(dt: Date) {
  return Math.floor(dt.getTime() / 1000);
}

export function makeTimestampSecsNow() {
  return makeTimestampSecs(new Date());
}
