// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {GuardianRegistry} from "../GuardianRegistry.sol";

contract TestGuardianRegistry {
    GuardianRegistry public guardianRegistry;

    constructor(GuardianRegistry _guardianRegistry) {
        guardianRegistry = _guardianRegistry;
    }

    function setGuardians(address[] memory _guardians) public {
        guardianRegistry.setGuardiansFor(address(this), _guardians);
    }

    function getGuardians() public view returns (address[] memory) {
        return guardianRegistry.getGuardiansFor(address(this));
    }

    function isGuardian(address _guardian) public view returns (bool) {
        return guardianRegistry.isGuardianFor(address(this), _guardian);
    }
}
