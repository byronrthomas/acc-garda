// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RiskLimited {
    // We have a single time window that the user has a chance to respond within
    uint256 public riskLimitTimeWindow;

    struct LimitRecord {
        uint256 limit;
        bool overridesDefault;
    }
    // We configure a value per token address that can be spent within this time window
    mapping(address => LimitRecord) public limitsPerToken;

    // And a default value for tokens that don't have a specific value
    uint256 public defaultRiskLimit;

    // We need a struct to store the amount spent per window
    struct Spends {
        uint256 spent;
        uint256 firstSpendTime;
    }

    // And a mapping to store the spends per token address
    mapping(address => Spends) public spends;

    // Allow all transactions by default => pass _defaultRiskLimit = MAX_VALUE
    // Block all transactions by default => pass _defaultRiskLimit = 0
    constructor(uint256 _riskLimitTimeWindow, uint256 _defaultRiskLimit) {
        riskLimitTimeWindow = _riskLimitTimeWindow;
        defaultRiskLimit = _defaultRiskLimit;
    }

    // If you set _amount = 0, it will block all transactions involving that token
    function _setSpecificRiskLimit(address _token, uint _amount) internal {
        LimitRecord storage limit = limitsPerToken[_token];
        limit.limit = _amount;
        limit.overridesDefault = true;
    }

    function _removeSpecificRiskLimit(address _token) internal {
        LimitRecord storage limit = limitsPerToken[_token];
        require(limit.overridesDefault, "Specific limit is not enabled");
        limit.limit = 0;
        limit.overridesDefault = false;
    }

    function _setDefaultRiskLimit(uint256 _amount) internal {
        defaultRiskLimit = _amount;
    }

    function _setRiskLimitTimeWindow(uint256 _timeWindowSecs) internal {
        riskLimitTimeWindow = _timeWindowSecs;
    }

    function _checkRiskLimit(address _token, uint256 _amount) internal {
        uint256 tokenLimit = limitForToken(_token);
        require(
            tokenLimit >= _amount,
            "Risk limit exceeded - transaction amount above limit"
        );

        uint256 timestamp = block.timestamp;
        Spends storage spend = spends[_token];
        // Reset spend window if a full window has passed since the first spend
        if (
            spend.spent > 0 &&
            timestamp > spend.firstSpendTime + riskLimitTimeWindow
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

    function limitForToken(address _token) public view returns (uint256) {
        LimitRecord memory limit = limitsPerToken[_token];
        if (limit.overridesDefault) {
            return limit.limit;
        } else {
            return defaultRiskLimit;
        }
    }
}
