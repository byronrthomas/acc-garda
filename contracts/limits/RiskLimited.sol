// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Allowances, AllowanceState} from "./Allowances.sol";

contract RiskLimited {
    using Allowances for AllowanceState;

    struct LimitRecord {
        uint256 limit;
        bool overridesDefault;
    }
    // For each account:
    struct RiskParams {
        // We have a single time window that the user has a chance to respond within
        uint256 riskLimitTimeWindow;
        // And a default value for tokens that don't have a specific value
        uint256 defaultRiskLimit;
        // We configure a value per token address that can be spent within this time window
        mapping(address => LimitRecord) limitsPerToken;
    }
    mapping(address => RiskParams) public riskParams;

    // We need a struct to store the amount spent per window
    struct Spends {
        uint256 spent;
        uint256 firstSpendTime;
    }

    // To track what's happening on each account
    struct RiskTracker {
        // Need a mapping to store the spends per token address
        mapping(address => Spends) spends;
        // We also allow pre-approval of spends (token-specific)
        mapping(address => AllowanceState) allowances;
    }
    mapping(address => RiskTracker) private riskTracker;

    function _getLimitRecord(
        address _account,
        address _token
    ) internal view returns (LimitRecord storage) {
        return riskParams[_account].limitsPerToken[_token];
    }

    function _getRiskParams(
        address _account
    ) internal view returns (RiskParams storage) {
        return riskParams[_account];
    }

    // If you set _amount = 0, it will block all transactions involving that token
    function _setSpecificRiskLimit(
        address _account,
        address _token,
        uint256 _amount
    ) internal {
        LimitRecord storage limit = _getLimitRecord(_account, _token);
        limit.limit = _amount;
        limit.overridesDefault = true;
    }

    function _removeSpecificRiskLimit(
        address _account,
        address _token
    ) internal {
        LimitRecord storage limit = _getLimitRecord(_account, _token);
        require(limit.overridesDefault, "Specific limit is not enabled");
        limit.limit = 0;
        limit.overridesDefault = false;
    }

    // Allow all transactions by default => pass _defaultRiskLimit = MAX_VALUE
    // Block all transactions by default => pass _defaultRiskLimit = 0
    function _setDefaultRiskLimit(address _account, uint256 _amount) internal {
        RiskParams storage params = _getRiskParams(_account);
        params.defaultRiskLimit = _amount;
    }

    function _setRiskLimitTimeWindow(
        address _account,
        uint256 _timeWindowSecs
    ) internal {
        RiskParams storage params = _getRiskParams(_account);
        params.riskLimitTimeWindow = _timeWindowSecs;
    }

    function _getTracker(
        address _account
    ) internal view returns (RiskTracker storage) {
        return riskTracker[_account];
    }

    function _checkAllowances(
        address _account,
        address _token,
        uint256 _amount
    ) private {
        uint256 available = allowanceAvailable(_account, _token);
        // solhint-disable-next-line reason-string
        require(
            available >= _amount,
            "Risk limit exceeded - transaction amount above limit, and above pre-approved allowances"
        );
        _getTracker(_account).allowances[_token].spendFromAllowances(_amount);
    }

    function _checkRiskLimit(
        address _account,
        address _token,
        uint256 _amount
    ) internal {
        uint256 tokenLimit = limitForToken(_account, _token);
        if (_amount > tokenLimit) {
            _checkAllowances(_account, _token, _amount);
        } else {
            _checkBelowLimitSpends(_account, tokenLimit, _token, _amount);
        }
    }

    function _checkBelowLimitSpends(
        address _account,
        uint256 tokenLimit,
        address _token,
        uint256 _amount
    ) private {
        // Treat a time window of zero as "completely disabled"
        RiskParams storage params = _getRiskParams(_account);
        if (params.riskLimitTimeWindow == 0) {
            return;
        }
        uint256 timestamp = block.timestamp;
        Spends storage spend = _getTracker(_account).spends[_token];
        // Reset spend window if a full window has passed since the first spend
        if (
            spend.spent > 0 &&
            timestamp > spend.firstSpendTime + params.riskLimitTimeWindow
        ) {
            spend.spent = 0;
            spend.firstSpendTime = timestamp;
        } else if (spend.spent == 0) {
            // If this is the first spend ever, set the first spend time
            spend.firstSpendTime = timestamp;
        }

        // Check if the spend is within the limit
        require(
            spend.spent + _amount <= tokenLimit,
            "Risk limit exceeded - total amount above limit"
        );
        // Update the spend
        spend.spent += _amount;
        // Using a storage var so no need to set back into mapping
        // (we've directly updated the mapping value)
    }

    function limitForToken(
        address _account,
        address _token
    ) public view returns (uint256) {
        RiskParams storage params = _getRiskParams(_account);
        LimitRecord memory limit = _getLimitRecord(_account, _token);
        if (limit.overridesDefault) {
            return limit.limit;
        } else {
            return params.defaultRiskLimit;
        }
    }

    function allowanceAvailable(
        address _account,
        address _token
    ) public view returns (uint256) {
        return _getTracker(_account).allowances[_token].allowanceAvailable();
    }

    function allowanceAvailableAtTime(
        address _account,
        address _token,
        uint256 _timestamp
    ) public view returns (uint256) {
        return
            _getTracker(_account).allowances[_token].allowanceAvailableAtTime(
                _timestamp
            );
    }

    function _addAllowance(
        address _account,
        address _token,
        uint256 _amount,
        uint256 _validFromTimestamp
    ) internal returns (uint256) {
        return
            _getTracker(_account).allowances[_token].addAllowance(
                _amount,
                _validFromTimestamp
            );
    }

    function _cancelAllowance(
        address _account,
        address _token,
        uint256 _id
    ) internal {
        _getTracker(_account).allowances[_token].cancelAllowance(_id);
    }

    function defaultRiskLimit(address _account) public view returns (uint256) {
        return _getRiskParams(_account).defaultRiskLimit;
    }

    function riskLimitTimeWindow(
        address _account
    ) public view returns (uint256) {
        return _getRiskParams(_account).riskLimitTimeWindow;
    }

    function spends(
        address _account,
        address _token
    ) public view returns (Spends memory) {
        return _getTracker(_account).spends[_token];
    }
}
