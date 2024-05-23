import { formatChainAsHexStr } from "./utils";
import { switchNetwork } from "./wallet/rpc";

const DESIRED_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID);
const DESIRED_CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME;

export type NetworkDetailPanelProps = {
  chainId: number;
  setChainId: (chainId: number) => void;
  provider: any;
};

export const NetworkDetailPanel = ({
  chainId,
  setChainId,
  provider,
}: NetworkDetailPanelProps) => {
  const handleSwitch = () => {
    switchNetwork(provider, formatChainAsHexStr(DESIRED_CHAIN_ID)).then(
      (result) => {
        if (result.success) {
          setChainId(DESIRED_CHAIN_ID);
        } else {
          alert("Could not switch network:" + result.errorMessage);
        }
      }
    );
  };

  if (chainId === DESIRED_CHAIN_ID) {
    return <div>You are connected to {DESIRED_CHAIN_NAME}</div>;
  }

  return (
    <>
      <div>You are connected to an unknown network</div>
      <div>
        This app only works on the {DESIRED_CHAIN_NAME} network. Please use the
        button to switch
      </div>
      <button onClick={handleSwitch}>
        Switch to <b>{DESIRED_CHAIN_NAME}</b>
      </button>
    </>
  );
};
