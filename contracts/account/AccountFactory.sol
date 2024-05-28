// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {DEPLOYER_SYSTEM_CONTRACT, IContractDeployer} from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import {SystemContractsCaller} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";

// Credit: the initial implementation of this takes heavy pointers from the example code in the ZKSync docs:
// https://docs.zksync.io/build/tutorials/smart-contract-development/account-abstraction/daily-spend-limit.html
contract AccountFactory {
    bytes32 public accountBytecodeHash;

    constructor(bytes32 _accountBytecodeHash) {
        accountBytecodeHash = _accountBytecodeHash;
    }

    function deployAccount(
        bytes32 salt,
        address owner,
        address[] memory guardianAddresses,
        uint256 votesRequired,
        string memory ownerDisplayName
    ) external returns (address accountAddress) {
        (bool success, bytes memory returnData) = SystemContractsCaller
            .systemCallWithReturndata(
                uint32(gasleft()),
                address(DEPLOYER_SYSTEM_CONTRACT),
                uint128(0),
                abi.encodeCall(
                    DEPLOYER_SYSTEM_CONTRACT.create2Account,
                    (
                        salt,
                        accountBytecodeHash,
                        abi.encode(
                            owner,
                            guardianAddresses,
                            votesRequired,
                            ownerDisplayName
                        ),
                        IContractDeployer.AccountAbstractionVersion.Version1
                    )
                )
            );
        require(success, "Deployment failed");
        (accountAddress) = abi.decode(returnData, (address));
    }
}
