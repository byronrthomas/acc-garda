// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {RiskLimited} from "../RiskLimited.sol";

// Just create public versions of all of the internal functions for testing purposes.
// Normal contracts should guard these functions with appropriate access controls.
contract TestRiskLimited is RiskLimited {
    constructor(
        uint256 _riskLimitTimeWindow,
        uint256 _defaultRiskLimit
    ) RiskLimited(_riskLimitTimeWindow, _defaultRiskLimit) {}

    function setSpecificRiskLimit(address _token, uint256 _amount) public {
        _setSpecificRiskLimit(_token, _amount);
    }

    function removeSpecificRiskLimit(address _token) public {
        _removeSpecificRiskLimit(_token);
    }

    function setDefaultRiskLimit(uint256 _amount) public {
        _setDefaultRiskLimit(_amount);
    }

    function setRiskLimitTimeWindow(uint256 _timeWindowSecs) public {
        _setRiskLimitTimeWindow(_timeWindowSecs);
    }

    function spend(address _token, uint256 _amount) public {
        // Simulates spending as the check function assumes the spend is happening
        // unless it blocks the spend
        _checkRiskLimit(_token, _amount);
    }
}
