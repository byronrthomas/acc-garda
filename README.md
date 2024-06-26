<p align="center">
  <img src="./vite-react-frontend/public/logo_full_colour.png" width="200px" alt="Logo">
</p>

# AccGarda SmartAccount for zkSync Era

A multi-asset Smart Account with configurable hack-resistance features including gasless guardianship, social recovery, time-delayed transactions and a simple frontend.

## Team

- Lead developer: Byron Thomas
  - Byron is a highly experienced software developer, who recently got into smart contracts and the Ethereum / Solidity ecosystem
  - He has a background in a variety of financial and commercial SAAS development, as well as Cybersecurity
  - He has spent around a year developing tooling and researching Bug Bounties in the Solidity ecosystem

## AccGarda smart account features

- AccGarda is a smart account, i.e. a contract that holds assets on behalf of a user (the user interacts as though they are the account, but sign everything using their own wallet)
- AccGarda has a social recovery mechanism, based on the concept of "Account guardians"
  - Account Guardians are other blockchain users that the account owner knows and trusts, and who can be trusted to act on their behalf
  - if a user loses their private key, or it gets revealed by an attacker, the user can propose to their guardians a new wallet address they want to use
  - they do this through the frontend app, which provides a link for the owner to share with the guardians
  - the guardians click the link, and follow the steps there to vote to approve the change
  - if enough guardians vote (there is a configurable threshold, e.g. 2 out of 3 guardians must approve) then the account ownership will change and will be owned by the replacement address
- _Unfortunately not working on testnet:_ The AccGarda account pays gas on behalf of guardians voting for changes - guardians do not need a balance to approve changes, they have **gasless** voting
- AccGarda has hack resistance features based around the ideas of detection & response to attack:
  - AccGarda publishes events for critical actions to the blockchain, allowing the possibility to set up a monitoring solution that will notify the owner if a transaction or unexpected vote happens
  - AccGarda allows the owner to configure limits over what can be spent within a given time period (e.g. 0.05 ETH over 5 days), so if an attacker makes a transaction it must be smaller than the limit, and the owner will have 5 days to notice and take action (like social recovery) before any more can be spent
- The risk settings are configurable by the owner at setup and can be changed in a safe manner:
  - The amount at risk can be changed per-token, e.g. a limit for ETH of 0.005 ETH, and a limit for LINK of 2 LINK
  - Settings that decrease risk (shorter time or lower limit) can be carried out immediately by the owner
  - Settings that increase risk need guardians to vote, as with social voting the user can share a link to ask the guardian to perform a gasless vote to approve (_unfortunately the gasless vote itself not currently working on testnet_)
- To add convenience there are workarounds for the risk limits:
  - An owner can submit approval for a high-value time-delayed transaction, for any amount above the limit, and then wait the full risk measurement time window (e.g. 5 days) before being able to spend that approved amount
  - Again, the idea is that if the attacker does this, there is time to notice and respond
  - Alternatively, an owner can request "break-glass" emergency approval for an above the limit spend, and again they get a link, share it with their guardians and ask the guardians to use a gasless vote to approve the spend (_unfortunately the gasless vote itself not currently working on testnet_)

## Deploy your own AccGarda Smart Account

### Deployment prerequisites

Ensure you are using a compatible node version (see `.node-version`) - this project has been developed and tested
with node 20.

Run `yarn install` to get all of the tooling ready.

### Setup & deployment guide

These instructions assume you have a wallet with ETH on the Sepolia Test network that you can use as a deployment account,
and you have the private key for it. You can also use the same account as the owner of your smart account, or use
another account that you know the private key for.

To deploy:

- Copy `.env.example` to `.env` and set the WALLET_PRIVATE_KEY to be the private key of **your deployment account** (note this account must have ETH)
- Find some accounts that you wish to be guardians of the smart account - normally friends that you know well who have their own Ethereum addresses. You can include as many guardians as you wish, just ask whoever you trust for their Ethereum address. Be sure that they know you might need them to help in an emergency. You encode your chosen guardians in the deploy command as `GUARDIANS='["0xEE7f0571F433165e61e55F61e88104664e4Cc28d","0xbd29A1B981925B94eEc5c4F1125AF02a2Ec4d1cA","0xedB6F5B4aab3dD95C7806Af42881FF12BE7e9daa"]'` if you have three guardians with the addresses shown (this is a JSON encoding of an array of strings)
- Based on the number of guardians you have, set a threshold for how many guardians you will require to approve **critical actions**, e.g. if you found 3 friends to be your guardians, you could set a threshold of 2 which means 2 out of 3 of your guardians need to approve actions via the blockchain
  - Choosing a number below the number of guardians (e.g. 2 out of 3 instead of 3 out of 3), decreases security slightly but increases convenience as it can be quicker to get fewer approvals, and it can allow you to get things approved even if one guardian becomes unavailable. Choose your threshold carefully, balancing these concerns.
  - You encode your chosen threshold in the deployment command as e.g. `NUM_APPROVALS_REQUIRED=2` if you are setting your threshold as 2 approvals required (out of however many guardians you have chosen)
- Choose a user-friendly piece of text to describe you, this is helpful so that your guardians can know they should be checking with you to see whether to approve something, you could choose something that they will instantly recognise as you e.g. "James - the guy with the big dogs and the band t-shirts". You can encode this into the deployment command with e.g. `OWNER_DISPLAY_NAME="James - the guy with the big dogs and the band t-shirts"`
- Choose which of **your accounts** you want to control the smart account from - signatures from this account will be needed to transfer assets / interact with contracts on behalf of the smart account. **You must know the private key for this address.** You can use your own deployment account if you wish, whichever account you choose, take it's address and supply it as the owner address, e.g. `OWNER_ADDRESS="0x8002cD98Cfb563492A6fB3E7C8243b7B9Ad4cc92"`
- Pick some risk settings, the default settings are that spends above 0.01 tokens / ETH must be time-delayed for 7 days (604,800 seconds), which may be too conservative
  - As a general rule, you should choose the time limit to be the amount of time you would reasonably take to notice an attacker using your account and respond, some potential limits might be one month (18,144,000 seconds), the default 7 days (604,800 seconds), or 1 day (86,400 seconds). It is unlikely you could notice and respond much faster than this. However, large value spends will also be delayed by the same amount of time, so it depends how much of an inconvenience this time delay is for pre-notifying high-value spending.
  - If you wish to have a shorter delay, e.g. one day (86400 seconds), you will encode this as `RISK_LIMIT_TIME_WINDOW_SECS="86400"`
  - Also as a general rule, you should choose token / ETH limits that reflect the maximum amount you are prepared to put at risk to an attacker (again balancing the convenience of having to delay similar transactions yourself). If you assume you can respond and defend within the time window of an attacker's first activity with your account, then the account will guarantee that the attacker hasn't transacted more than the limit of ETH, and whatever limits have been set per-token (you can set specific token limits to apply separately to the default limit after you deploy the account)
  - If you wish to have a higher default limit, say 0.05, you will encode this as `RISK_LIMIT_DEFAULT_LIMIT="0.05"`

Put all of this together into the deployment command, to run from the root of this repo. Following the example choices
taken above, and using the version of the contracts deployed to the Testnet during [this deployment on the 2nd June 2024](https://sepolia.explorer.zksync.io/address/0x08829d762208ba87FB84ac3D376237f34f50300a):

```
GUARDIANS='["0xEE7f0571F433165e61e55F61e88104664e4Cc28d","0xbd29A1B981925B94eEc5c4F1125AF02a2Ec4d1cA","0xedB6F5B4aab3dD95C7806Af42881FF12BE7e9daa"]' \
NUM_APPROVALS_REQUIRED=2 \
OWNER_DISPLAY_NAME="James - the guy with the big dogs and the band t-shirts" \
OWNER_ADDRESS="0x8002cD98Cfb563492A6fB3E7C8243b7B9Ad4cc92" \
RISK_LIMIT_TIME_WINDOW_SECS="86400" \
RISK_LIMIT_DEFAULT_LIMIT="0.05" \
ACCOUNT_FACTORY_ADDRESS="0x08829d762208ba87FB84ac3D376237f34f50300a" \
npx hardhat deploy-zksync --script deploy.ts --network zkSyncSepoliaTestnet
```

**NOTE** after deploying your smart account, you should transfer your ETH to it, as it is intended to hold
assets on your behalf. It also needs ETH so that it can provide the fees for
your guardians to vote on critical actions.

### Other options on deploying your account

- If you wish to redeploy fresh contracts, then you should run `yarn run compile` first, and then drop `ACCOUNT_FACTORY_ADDRESS=...` from the command (which will deploy both factory & account in combination)
- You can drop --network zkSyncSepoliaTestnet if you just wish to deploy locally to the dockerized node, or supply another value from hardhat config

## Using your account

_NOTE: unfortunately some of the voting functionality described below seems to be broken or intermittently broken on the testnet at the moment, apologies for this and I hope to fix it soon_

- You should use the link you got the at the end of the deployment process to access your account - the web app frontend makes
  it much more convenient
- The app needs to connect to whatever wallet you have set as the account owner - you will be transacting on behalf of
  the account and using the wallet to sign the transactions
- You can send ETH or tokens to the account using whatever tools you would normally use to interact from the sending accounts
- To send ETH or tokens from the account, or interact with other contracts, connect the web app to your wallet, and then use the "Transaction" panel in the app
  - You currently need to hand-code the "data" field to transfer ERC-20s and do other contract interactions, expect support for the main ERC-20 methods soon
- To use the social recovery, use the panel to set a "New owner address", take the link and share it with your guardians
  - When your guardians use the link, they are shown some confirmation messages and asked to vote to approve the change, they should connect the app to their wallet to do so
  - Once enough votes are received the new owner address will be instantly set, if due to mistakes or confusion, a series of votes for different owner addresses arrive the vote count is reset each time a different address is voted
- To change risk parameter settings, use the panel
  - If the settings are to decrease the limit for a token (less valuable, less risk), then you can instantly approve it, otherwise you need to send links to your guardians to vote on it (same rules as social recovery apply)
- To spend above the risk limit threshold you have two options:
  - Submit a time-delayed transaction - you submit a pre-approval that applies from a future time (which is always at least a full time window away, e.g. 7 days if you have the setup in the command above)
  - Use the "Break glass" panel to ask your guardians to vote on an immediate pre-approval for the amount (same rules as social recovery applies)
- For more pointers see the [demo video](https://youtu.be/ohDS0xMGJf8)

## Security warnings

Apart from obviously being careful with your own private keys, you should:

- Set up some monitoring of your smart account so that you can notice if somebody else is taking actions with it you don't expect - please contact me via the issues if you would like a pre-packaged solution to help with this, some of the options are quite developer-focused right now but it's important
- Be sure that you trust your guardians - a malicious guardian can drain your account by voting which will drain your
  account ETH because your smart account will pay for their gas to vote
- Wait for us to publish security audits before using this for real!

## Hackathon submission info

This project was originally developed for the zkSync Account Abstraction prize on the Chainlink BlockMagic Hackathon.

### Integration with Chainlink

AccGarda was developed in a short space of time, taking the zkSync Account Abstraction features as inspiration. Unfortunately,
I did not have time to integrate Chainlink into the project, but I believe AccGarda is still eligible for submission
against the zkSync Account Abstraction prizes, because the Requirements section of the [Hackathon overview page](https://chainlinkblockmagic.devpost.com/) says:

> "For sponsor prizes, you do not have to use Chainlink - but to make your project as best as it can be using the materials here, it is recommended you do!"

## Technical details

### ERC-20 token spend limiting

AccGarda protects ERC-20 tokens by detecting calls that could lead to the ERC-20 tokens owned by the account.
In order to do this, it has to use a fixed list of potential calls, which were chosen to cover all of OpenZepellin's
ERC20 APIs. Specifically, the following are intercepted and checked against risk limits when called with the smart account as the `from` address:

- `transfer(address recipient, uint256 amount)` - when sent by the smart account this transfers it's tokens to another account
- `approve(address spender, uint256 amount)` - this approves another account to have access to some of the smart account's tokens
- `increaseAllowance(address spender, uint256 addedValue)` - this increases the amount of the smart account's token that the spender address has access to
  - NOTE: there is also a `decreaseAllowance` function, but AccGarda doesn't currently handle subtracting from risk limits, so AccGarda doesn't track risk limits accurately if this function is used. However, this limitation means AccGarda is more restrictive than it should be, so it is safe, even if not as convenient as it should be
- `burn(uint256 amount)` - this burns the smart account's tokens

The following methods would typically not be called with the smart account as the `from` address if an attacker was aiming
to obtain the smart account's tokens. They also all depend on the approved allowance to spend, which are risk-limited functions:

- `transferFrom(address sender, address recipient, uint256 amount)` caller needs to have enough allowance to handle it, i.e. they need to have previously used the `approve` or `increaseAllowance` functions
- `burnFrom(address account, uint256 amount)` - ditto

#### IERC20Permit limitation

There is an EIP to create an `IERC20Permit` token interface which is to be used for Ethereum-native account abstractions. This adds a `permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)` function, which would typically not be called by the owner of the tokens directly. Hence I cannot
protect this function, and so the user should be wary using any tokens that have this method.

### Project Layout

- `/contracts`: Contains solidity smart contracts.
- `/deploy`: Scripts for contract deployment.
- `/scripts`: Other useful scripts for interacting with the blockchain & deployed artifacts.
- `/test`: Test files.
- `/vite-react-frontend`: The codebase for the web app
- `hardhat.config.ts`: Configuration settings.

### Basic commands for developers

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
WALLET_PRIVATE_KEY="0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110" GUARDIANS='["0xEE7f0571F433165e61e55F61e88104664e4Cc28d","0xbd29A1B981925B94eEc5c4F1125AF02a2Ec4d1cA","0xedB6F5B4aab3dD95C7806Af42881FF12BE7e9daa"]' \
NUM_APPROVALS_REQUIRED=2 \
OWNER_DISPLAY_NAME="James - the guy with the big dogs and the band t-shirts" \
OWNER_ADDRESS="0x8002cD98Cfb563492A6fB3E7C8243b7B9Ad4cc92" \
RISK_LIMIT_TIME_WINDOW_SECS="86400" \
RISK_LIMIT_DEFAULT_LIMIT="0.05" \
npx hardhat deploy-zksync --script deploy.ts
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

I went with the recommended rules for solhint, but disabled the following rules:

- gas-custom-error: Although replacing require statements with a message for revert statements with a custom error is
  best practice, it does make programmatically interacting with contracts awkward because ethers.js for example, doesn't
  give you the error data back in a consumable format. This makes checking error cases in tests especially difficult, which
  could lead to false positives. To avoid this, I disable the rule and just use require statements
- reason-string: I've been more lenient on how long I allow reason strings to be, as I feel like informative error
  messages are more helpful than trying to squeeze into an arbitrarily low limit

## License

This project is under the [MIT](./LICENSE) license.
