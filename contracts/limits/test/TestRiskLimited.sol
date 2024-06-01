// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import {RiskLimited} from "../RiskLimited.sol";

// Just create public versions of all of the internal functions for testing purposes.
// Normal contracts should guard these functions with appropriate access controls.
contract TestRiskLimited is RiskLimited {
    constructor(uint256 _riskLimitTimeWindow, uint256 _defaultRiskLimit) {
        _setRiskLimitTimeWindow(msg.sender, _riskLimitTimeWindow);
        _setDefaultRiskLimit(msg.sender, _defaultRiskLimit);
    }

    function setSpecificRiskLimit(address _token, uint256 _amount) public {
        _setSpecificRiskLimit(msg.sender, _token, _amount);
    }

    function removeSpecificRiskLimit(address _token) public {
        _removeSpecificRiskLimit(msg.sender, _token);
    }

    function setDefaultRiskLimit(uint256 _amount) public {
        _setDefaultRiskLimit(msg.sender, _amount);
    }

    function setRiskLimitTimeWindow(uint256 _timeWindowSecs) public {
        _setRiskLimitTimeWindow(msg.sender, _timeWindowSecs);
    }

    function spend(address _token, uint256 _amount) public {
        // Simulates spending as the check function assumes the spend is happening
        // unless it blocks the spend
        _checkRiskLimit(msg.sender, _token, _amount);
    }

    function addAllowance(
        address _token,
        uint256 _amount,
        uint256 _validFromTimestamp
    ) public returns (uint256) {
        return _addAllowance(msg.sender, _token, _amount, _validFromTimestamp);
    }

    function cancelAllowance(address _token, uint256 _id) public {
        _cancelAllowance(msg.sender, _token, _id);
    }

    function lastAllowanceId(address _token) public view returns (uint256) {
        return _getTracker(msg.sender).allowances[_token].prevId;
    }
}
