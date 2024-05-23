import "./style.css";
import {
  listProviders,
  ConnectionState,
  switchNetwork,
  formatChainId,
} from "./providers.ts";

let appState: ConnectionState = {
  isConnected: false,
};

const DESIRED_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID);
const DESIRED_CHAIN_NAME = import.meta.env.VITE_CHAIN_NAME;

function isCorrectChain(connState: ConnectionState) {
  console.log("isCorrectChain - DESIRED", DESIRED_CHAIN_ID);
  console.log(typeof DESIRED_CHAIN_ID);
  console.log("isCorrectChain - ACTUAL", connState.connectedState!.chainId);
  console.log(typeof connState.connectedState!.chainId);
  return (
    connState.isConnected &&
    connState.connectedState!.chainId === DESIRED_CHAIN_ID
  );
}

function renderChainSelectPanel(
  appState: ConnectionState,
  innerElement: HTMLDivElement
) {
  const correctChain = isCorrectChain(appState);
  if (correctChain) {
    innerElement.innerHTML = `
      <div>
        <div>You are currently connected to the ${DESIRED_CHAIN_NAME} network.</div>
      </div>
    `;
  } else {
    innerElement.innerHTML = `
    <div>
      <div>You are currently connected to an Unknown network.</div>
      <div>This app only works on the ${DESIRED_CHAIN_NAME} network. Please use the button to switch</div>
      <button id="switchNetwork">Switch to ${DESIRED_CHAIN_NAME}</button>
    </div>
  `;
    const theButton =
      innerElement.querySelector<HTMLButtonElement>("#switchNetwork");
    console.log("theButton", theButton);
    theButton!.onclick = () => {
      switchNetwork(
        appState,
        formatChainId(DESIRED_CHAIN_ID),
        (newAppState) => {
          appState = newAppState;
          loadApp();
        },
        (error) => {
          alert(
            `Couldn't switch to the ${DESIRED_CHAIN_NAME} network: ${error}`
          );
        }
      );
    };
  }
}

function loadApp() {
  console.log("Loading app - isConnected:", appState.isConnected);
  if (appState.isConnected) {
    const outerElement = document.querySelector<HTMLDivElement>("#app")!;
    outerElement.innerHTML = `
      <div>
        <h1>Connected!</h1>
        <div id=chainSelectPanel/><div>
      </div>
    `;
    renderChainSelectPanel(
      appState,
      outerElement.querySelector<HTMLDivElement>("#chainSelectPanel")!
    );
  } else {
    document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
      <div>
        <h1>Connect to a provider</h1>
        <div id="providerButtons"></div>
        ${
          appState.connectionError
            ? `<div>Connection failure: ${appState.connectionError}</div>`
            : ""
        }
      </div>
    `;
    listProviders(
      document.querySelector<HTMLDivElement>("#providerButtons")!,
      (newAppState) => {
        appState = newAppState;
        loadApp();
      }
    );
  }
}
loadApp();
// document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
//   <div>
//     <div id="providerButtons"></div>
//   </div>
// `;

// listProviders(document.querySelector<HTMLDivElement>("#providerButtons")!);
