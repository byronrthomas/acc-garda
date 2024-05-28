# accGarda SmartAccount for zkSync Era

A Smart Account for zkSync ERA with configurable hack-resistance features including gasless social recovery and a simple frontend.

## Team

- Lead developer: Byron Thomas
  - Byron is a highly experienced software developer, who recently got into smart contracts and the Ethereum / Solidity ecosystem
  - He has a background in a variety of financial and commercial SAAS development, as well as Cybersecurity
  - He has spent around a year developing tooling and researching Bug Bounties in the Solidity ecosystem

## Deployment prerequisites

Ensure you are using a compatible node version (see `.node-version`) - this project has been developed and tested
with node 20.

Run `yarn install` to get all of the tooling ready.

## Deploy your own appGarda Smart Account

These instructions assume you have a wallet with ETH on the Sepolia Test network that you can use as a deployment account,
and you have the private key for it. You can also use the same account as the owner of your smart account, or use
another account that you know the private key for.

To deploy:

- Copy `.env.example` to `.env` and set the WALLET_PRIVATE_KEY to be the private key of **your deployment account** (note this account must have ETH)
- Find some accounts that you wish to be guardians of the smart account - normally friends that you know well who have their own Ethereum addresses. You can include as many guardians as you wish, just ask whoever you trust for their Ethereum address. Be sure that they know you might need them to help in an emergency. You encode your chosen guardians in the deploy command as `GUARDIANS='["0xEE7f0571F433165e61e55F61e88104664e4Cc28d","0xbd29A1B981925B94eEc5c4F1125AF02a2Ec4d1cA","0xedB6F5B4aab3dD95C7806Af42881FF12BE7e9daa"]'` if you have three guardians with the addresses shown (this is a JSON encoding of an array of strings)
- Based on the number of guardians you have, set a threshold for how many guardians you will require to approve **critical actions**, e.g. if you found 3 friends to be your guardians, you could set a threshold of 2 which means 2 out of 3 of your guardians need to approve actions via the blockchain
  - Choosing a number below the number of guardians (e.g. 2 out of 3 instead of 3 out of 3), decreases security slightly but increases convenience as it can be quicker to get fewer approvals, and it can allow you to get things approved even if one guardian becomes unavailable. Choose your threshold carefully, balancing these concerns.
  - You encode your chosen threshold in the deployment command as e.g. `NUM_APPROVALS_REQUIRED=2` if you are setting your threshold as 2 approvals required (out of however many guardians you have chosen)
- Choose a user-friendly piece of text to describe you, this is helpful so that your guardians can know they should be checking with you to see whether to approve something, you could choose something that they will instantly recognise as you e.g. "Your friend Byron from uni". You can encode this into the deployment command with e.g. `OWNER_DISPLAY_NAME="Your friend Byron from uni"`
- Choose which of **your accounts** you want to control the smart account from - signatures from this account will be needed to transfer assets / interact with contracts on behalf of the smart account. **You must know the private key for this address.** You can use your own deployment account if you wish, whichever account you choose, take it's address and supply it as the owner address, e.g. `OWNER_ADDRESS="0x8002cD98Cfb563492A6fB3E7C8243b7B9Ad4cc92"`

Put all of this together into the deployment command, to run from the root of this repo. Following the example choices
taken above, and using the version of the contracts deployed to the Testnet on **TODO_DATE AND LINK TO BLOCK EXPLORER**:

```
GUARDIANS='["0xEE7f0571F433165e61e55F61e88104664e4Cc28d","0xbd29A1B981925B94eEc5c4F1125AF02a2Ec4d1cA","0xedB6F5B4aab3dD95C7806Af42881FF12BE7e9daa"]' \
NUM_APPROVALS_REQUIRED=2 \
OWNER_DISPLAY_NAME="Your friend Byron from uni" \
OWNER_ADDRESS="0x8002cD98Cfb563492A6fB3E7C8243b7B9Ad4cc92" \
ACCOUNT_FACTORY_ADDRESS="0x8E0082F5eC5F659eAc55EcebC2Ac68bB9951Ae48" \
npx hardhat deploy-zksync --script deploy.ts --network zkSyncSepoliaTestnet
```

**TODO** - put the correct factory account address into the ENV vars above!

**NOTE** after deploying your smart account, you should transfer your ETH to it, as it is intended to hold
assets on your behalf. It also needs ETH so that it can provide the fees for
your guardians to vote on critical actions.

### Other options on deploying your account

- If you wish to redeploy fresh contracts, then you should run `yarn run compile` first, and then drop `ACCOUNT_FACTORY_ADDRESS=...` from the command (which will deploy both factory & account in combination)
- You can drop --network zkSyncSepoliaTestnet if you just wish to deploy locally to the dockerized node, or supply another value from hardhat config

## appGarda smart account features

TODO

## Account security warnings

Apart from obviously being careful with your own private keys, you should:

- Set up some monitoring of your smart account so that you can notice if somebody else is taking actions with it you don't expect
- Be sure that you trust your guardians - a malicious guardian can drain your account by voting which will drain your
  account ETH because your smart account will pay for their gas to vote
  - It's hard to be resistant to this whilst still allowing for recovery when you've lost the private key of the owner account, and whilst giving your guardians gasless voting

## Hackathon submission info

This project was originally developed for the zkSync Account Abstraction prize on the Chainlink BlockMagic Hackathon.

### Hackathon project description

TODO

## Project Layout

- `/contracts`: Contains solidity smart contracts.
- `/deploy`: Scripts for contract deployment.
- `/scripts`: Other useful scripts for interacting with the blockchain & deployed artifacts.
- `/test`: Test files.
- `hardhat.config.ts`: Configuration settings.

## Basic commands for developers

- Run the dockerized node: `npx zksync-cli dev start`
- `yarn run compile`: Compiles contracts.
- `yarn run deploy`: Deploys using script `/deploy/deploy.ts`.
- `yarn run interact`: Interacts with the deployed contract using `/deploy/interact.ts`.
- `yarn run test`: Tests the contracts.
- `yarn run lint:sol`: Runs the contracts through solhint to check for common issues and that best practices are followed.

Note: Both `npm run deploy` and `npm run interact` are set in the `package.json`. You can also run your files directly, for example: `npx hardhat deploy-zksync --script deploy.ts`

### Deploy the smart account to a local network

NOTE: this private key is LOCAL_RICH_WALLETS[0] on the local network, as it isn't sensitive it's passed on the command line, rather than via .env.

Run `yarn run compile` and then to deploy fresh versions of everything:

```
WALLET_PRIVATE_KEY="0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110" GUARDIANS='["0xEE7f0571F433165e61e55F61e88104664e4Cc28d","0x2a23b205d8e39fe0af693B15329Ed827e3740c97"]' NUM_SIGNATURES_REQUIRED=1 OWNER_DISPLAY_NAME="ChainLink blockMagic owner (Byron)" OWNER_ADDRESS="0x8C1758654b59359e1824b4b65607A54731f2Ee87" npx  hardhat deploy-zksync --script deploy.ts
```

### Example commands of running utility scripts

Transfer from wallet with specified private key to other address the amount in ETH on test network (NOTE: you can also put these vars into .env)

`WALLET_PRIVATE_KEY="0x19..." TO_ADDRESS="0xEE7f0571F433165e61e55F61e88104664e4Cc28d" AMOUNT="0.009" npx hardhat run --no-compile  --network zkSyncSepoliaTestnet scripts/normalTransfer.ts`

Transfer from smart account with specified address, back to owner account with specified pk (must be owner of the smart account) on test network (NOTE: you can also put these vars into .env):

`OWNER_PRIVATE_KEY="0x19b6edf3fab4af2ebae0d3110f222390b751b633db0954c638d50b91ddf0fe18" SMART_ACCOUNT_ADDRESS="0x7C1a6E6be5d3EE66440d7735Cc2403521720BB5e"  npx hardhat run --no-compile scripts/recoverasset.ts --network zkSyncSepoliaTestnet`

### Environment Settings

To keep private keys safe, this project pulls in environment variables from `.env` files. Primarily, it fetches the wallet's private key.

Rename `.env.example` to `.env` and fill in your private key:

```

WALLET_PRIVATE_KEY=your_private_key_here...

```

### Network Support

`hardhat.config.ts` comes with a list of networks to deploy and test contracts. Add more by adjusting the `networks` section in the `hardhat.config.ts`. To make a network the default, set the `defaultNetwork` to its name. You can also override the default using the `--network` option, like: `hardhat test --network dockerizedNode`.

### Local Tests

Running `npm run test` by default runs the [Dockerized Node](https://era.zksync.io/docs/tools/testing/era-test-node.html) provided by the [@matterlabs/hardhat-zksync-node](https://era.zksync.io/docs/tools/hardhat/hardhat-zksync-node.html) tool.

### Linting using solhint

We went with the recommended rules for solhint, but disabled the following rules:

- gas-custom-error: Although replacing require statements with a message for revert statements with a custom error is
  best practice, it does make programmatically interacting with contracts awkward because ethers.js for example, doesn't
  give you the error data back in a consumable format. This makes checking error cases in tests especially difficult, which
  could lead to false positives. To avoid this, we disable the rule and just use require statements
- no-global-import: Although we understand why this is a recommendation, we feel it is a question of style, so we allow global imports

## License

This project is under the [MIT](./LICENSE) license.
