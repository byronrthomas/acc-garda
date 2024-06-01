// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {DEPLOYER_SYSTEM_CONTRACT, IContractDeployer} from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import {SystemContractsCaller} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";
import {GuardianRegistry} from "../roles/GuardianRegistry.sol";

// Credit: the initial implementation of this takes heavy pointers from the example code in the ZKSync docs:
// https://docs.zksync.io/build/tutorials/smart-contract-development/account-abstraction/daily-spend-limit.html

// NOTE: sincce this account factory bakes in a version of the account contract itself (via the bytecode hash)
// it also captures all of the dependencies of the account contract. So if you change any of the code the account
// contract relies upon, you deploy a new factory with the new deployed versions of the dependencies.
contract AccountFactory {
    bytes32 public accountBytecodeHash;
    address public guardianRegistryAddress;

    constructor(
        bytes32 _accountBytecodeHash,
        GuardianRegistry _guardianRegistry
    ) {
        accountBytecodeHash = _accountBytecodeHash;
        require(
            address(_guardianRegistry) != address(0),
            "GuardianRegistry address cannot be 0"
        );
        guardianRegistryAddress = address(_guardianRegistry);
    }

    function deployAccount(
        bytes32 salt,
        address owner,
        address[] memory guardianAddresses,
        uint256 votesRequired,
        string memory ownerDisplayName,
        uint256 riskLimitTimeWindow,
        uint256 defaultRiskLimit
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
                            guardianRegistryAddress,
                            owner,
                            guardianAddresses,
                            votesRequired,
                            ownerDisplayName,
                            riskLimitTimeWindow,
                            defaultRiskLimit
                        ),
                        IContractDeployer.AccountAbstractionVersion.Version1
                    )
                )
            );
        require(success, "Deployment failed");
        (accountAddress) = abi.decode(returnData, (address));
    }
}
