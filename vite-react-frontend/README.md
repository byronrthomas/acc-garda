# AccGarda Frontend

This is a simple dApp frontend for accGarda for zkSync built using React + Typescript + Vite.

## User functionality

This frontend is only intended to be used with the smart contracts available from accGarda - see the [github repo](https://github.com/byronrthomas/acc-garda) for more information.

It provides a simplistic interface for interacting with the smart account contract, specifically:

- For the purposes of social recovery:
  - Guardians can use the frontend to vote for a new account owner **without spending gas**
  - An account owner can propose a new owner address by generating the links guardians can use to vote
- For the purposes of smart account operation:
  - The account owner can transact via the smart account

## User Pre-requisites

The app requires a user to have a EIP-1193 compatible wallet provider (so far it has only been tested using the Metamask browser extension).

You should have an accGarda smart account deployed using the [instructions in the smart contracts readme](../README.md) - please take a note of **your deployed account address on the testnet**.

## User instructions

You can see the live app at [https://acc-garda.web.app](https://acc-garda.web.app/?contractAddress=0x7C1a6E6be5d3EE66440d7735Cc2403521720BB5e)

The live app only interacts with the zkSync Sepolia Testnet (the app needs to use the Testnet RPC to fetch contract information).

If you have deployed a smart account of your own to the testnet, you can interact with it by supplying contract address in your URL
search parameters, i.e. navigate to https://acc-garda.web.app/?contractAddress=0xffffffffffffffffffffffffffffffffffffffff (replacing 0xffffffffffffffffffffffffffffffffffffffff with your contract's address).

## Developer pre-requisites

The development has used node v20 (see `.node-version`). You should use something compatible with this, and use yarn.
To begin run `yarn install` in this frontend directory.

To run as a dev server, use `yarn dev`.

## Run a dev server

You can run a local version of the frontend using `yarn run dev` - this assumes by default that you also have a local
zkSync running (e.g. the dockerized node). See the [configuration instructions below](#developing-the-frontend---configuration) for more information.

## Deployment instructions

### Build assets

Before deploying, build the latest versions of assets for production using `yarn run build`.

### Deployment setup

This app has been deployed via Firebase, using their hosting feature. In order to deploy for yourself, use the Firebase
console to set up a new project to host the deployment, and then follow Firebase's own instructions on how to install
the firebase CLI.

After this, in this (vite-react-frontend) directory, run the following commands.

Log in to your firebase account:
`firebase login`

Initialise the project:
`firebase init`

Firebase CLI will then interactively ask a series of configuration questions, the answers should be as follows:

- For "Which Firebase features do you want to set up for this directory?", select only "Hosting: Configure files for Firebase Hosting and (optionally) set up GitHub Action deploys"
- For "Project setup", select "Use an existing project"
- Then choose the project you've set up in the console as the "Default firebase project"
- For "What do you want to use as your public directory?" Type "dist"
- For "Configure as a single-page app (rewrite all urls to /index.html)?" Enter "Y"
- For "Set up automatic builds and deploys with GitHub?" Enter "N"
- For "File dist/index.html already exists. Overwrite?" Enter "N"

### Run deployment

After this point, assuming you have already [built the assets](#build-assets) - you should be able to run `firebase deploy` to deploy to the Firebase hosting service.

## Developing the frontend - configuration

The project uses Vite's env var handling, so `.env` is loaded during development builds (i.e. `yarn run dev`),
whereas `.env.production` is baked in when building for production (i.e. `yarn run build`). These files should
contain the same keys, and the original intention is that dev mode runs against a local node (e.g. dockerized node),
whereas the production mode runs against ZkSync Sepolia Testnet.

For a description of the keys required, see the comments in the `.env` files directly. These values will not need
changing if you're running with the dockerized zkSync node and the live testnet for production (except the default contract address which is not very important).

### Secrets

Neither `.env` or `.env.production` were intended to contain secret values, hence they are checked into the repo.

If you wish to include secrets, you should add them in `.env.local` and `.env.production.local` which will be included
like the other env vars, but won't get checked in.
See [Vite's env var handling documentation](https://vitejs.dev/guide/env-and-mode.html) for more info. Be careful if
you do this, as the secrets will still be included in built assets, so can be read by others if you deploy the assets publicly.
