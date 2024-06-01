// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {DEPLOYER_SYSTEM_CONTRACT, IContractDeployer} from "@matterlabs/zksync-contracts/l2/system-contracts/Constants.sol";
import {SystemContractsCaller} from "@matterlabs/zksync-contracts/l2/system-contracts/libraries/SystemContractsCaller.sol";
import {IContractRegistry} from "./IContractRegistry.sol";
import {GuardianRegistry} from "../roles/GuardianRegistry.sol";
import {OwnershipRegistry} from "../roles/OwnershipRegistry.sol";
import {RiskManager} from "../limits/RiskManager.sol";

// Credit: the initial implementation of this takes heavy pointers from the example code in the ZKSync docs:
// https://docs.zksync.io/build/tutorials/smart-contract-development/account-abstraction/daily-spend-limit.html

// NOTE: sincce this account factory bakes in a version of the account contract itself (via the bytecode hash)
// it also captures all of the dependencies of the account contract. So if you change any of the code the account
// contract relies upon, you deploy a new factory with the new deployed versions of the dependencies.
contract AccountFactory is IContractRegistry {
    bytes32 public accountBytecodeHash;
    GuardianRegistry public guardianRegistry;
    OwnershipRegistry public ownershipRegistry;
    RiskManager public riskManager;

    constructor(
        bytes32 _accountBytecodeHash,
        GuardianRegistry _guardianRegistry,
        OwnershipRegistry _ownershipRegistry,
        RiskManager _riskManager
    ) {
        accountBytecodeHash = _accountBytecodeHash;
        require(
            address(_guardianRegistry) != address(0),
            "GuardianRegistry address cannot be 0"
        );
        guardianRegistry = _guardianRegistry;
        require(
            address(_ownershipRegistry) != address(0),
            "OwnershipRegistry address cannot be 0"
        );
        ownershipRegistry = _ownershipRegistry;
        require(
            address(_riskManager) != address(0),
            "RiskManager address cannot be 0"
        );
        riskManager = _riskManager;
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
                            address(this),
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
