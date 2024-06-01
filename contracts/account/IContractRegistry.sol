// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {GuardianRegistry} from "../roles/GuardianRegistry.sol";
import {OwnershipRegistry} from "../roles/OwnershipRegistry.sol";

interface IContractRegistry {
    function guardianRegistry() external view returns (GuardianRegistry);
    function ownershipRegistry() external view returns (OwnershipRegistry);
}
