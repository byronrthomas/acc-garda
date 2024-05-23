import "./style.css";
import { listProviders, ConnectionState } from "./providers.ts";

let appState: ConnectionState = {
  isConnected: false,
};

function loadApp() {
  console.log("Loading app - isConnected:", appState.isConnected);
  if (appState.isConnected) {
    document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
      <div>
        <h1>Connected!</h1>
      </div>
    `;
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
