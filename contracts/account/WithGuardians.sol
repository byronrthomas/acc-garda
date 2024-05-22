// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";

/**
Contract intended to be used mostly as a mix-in via subclassing.
It allows to store a set of guardian addresses and provides basic set-related functions.
 */
contract WithGuardians {
    using EnumerableSet for EnumerableSet.AddressSet;

    EnumerableSet.AddressSet private guardianAddresses;

    constructor(address[] memory _guardianAddresses) {
        for (uint x = 0; x < _guardianAddresses.length; ++x) {
            guardianAddresses.add(_guardianAddresses[x]);
        }
    }

    function guardianCount() public view returns (uint) {
        return guardianAddresses.length();
    }

    function isGuardian(address a) public view returns (bool) {
        return guardianAddresses.contains(a);
    }

    function guardianAtIndex(uint index) public view returns (address) {
        return guardianAddresses.at(index);
    }
}
