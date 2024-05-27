# zkSync Hardhat project template

This project was scaffolded with [zksync-cli](https://github.com/matter-labs/zksync-cli).

## Project Layout

- `/contracts`: Contains solidity smart contracts.
- `/deploy`: Scripts for contract deployment and interaction.
- `/test`: Test files.
- `hardhat.config.ts`: Configuration settings.

## How to Use

- Run the in-memory node: `npx zksync-cli dev start`
- `npm run compile`: Compiles contracts.
- `npm run deploy`: Deploys using script `/deploy/deploy.ts`.
- `npm run interact`: Interacts with the deployed contract using `/deploy/interact.ts`.
- `npm run test`: Tests the contracts.

Note: Both `npm run deploy` and `npm run interact` are set in the `package.json`. You can also run your files directly, for example: `npx hardhat deploy-zksync --script deploy.ts`

### Deploy the smart account to a local network

Using LOCAL_RICH_WALLETS[0] private key to deploy, and with LOCAL_RICH_WALLETS[9] and EXTRA_GUARDIAN addresses as guardians:

`WALLET_PRIVATE_KEY="0x7726827caac94a7f9e1b160f7ea819f172f7b6f9d2a97f992c38edeab82d4110" EXTRA_GUARDIAN="0xEE7f0571F433165e61e55F61e88104664e4Cc28d" npm run hardhat deploy-zksync --script deploy.ts`

### Example commands of running utility scripts

Transfer from wallet with specified private key to other address the amount in ETH on test network:

`WALLET_PRIVATE_KEY="0x19..." TO_ADDRESS="0xEE7f0571F433165e61e55F61e88104664e4Cc28d" AMOUNT="0.009" npx hardhat run --no-compile  --network zkSyncSepoliaTestnet scripts/normalTransfer.ts`

Transfer from smart account with specified address, back to owner account with specified pk (must be owner of the smart account) on test network:

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

Running `npm run test` by default runs the [zkSync In-memory Node](https://era.zksync.io/docs/tools/testing/era-test-node.html) provided by the [@matterlabs/hardhat-zksync-node](https://era.zksync.io/docs/tools/hardhat/hardhat-zksync-node.html) tool.

Important: zkSync In-memory Node currently supports only the L2 node. If contracts also need L1, use another testing environment like Dockerized Node. Refer to [test documentation](https://era.zksync.io/docs/tools/testing/) for details.

## Useful Links

- [Docs](https://era.zksync.io/docs/dev/)
- [Official Site](https://zksync.io/)
- [GitHub](https://github.com/matter-labs)
- [Twitter](https://twitter.com/zksync)
- [Discord](https://join.zksync.dev/)

## License

This project is under the [MIT](./LICENSE) license.
