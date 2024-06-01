// SPDX-License-Identifier: MIT
pragma solidity ^0.8.17;

import {RiskLimited} from "./RiskLimited.sol";
import {GuardianRegistry} from "../roles/GuardianRegistry.sol";

/**
 * @title RiskManager
 * @dev Front door to all of the Risk management functionality that the GuardedAccount
 * uses to track spends and allowances and enforce risk limits.
 */
contract RiskManager is RiskLimited {
    // NOTE: this doesn't need changing from the account level, as it
    // should just be the contract address of the smart account.
    struct VoteRecords {
        bool initialised;
        uint16 numVotesRequired;
        mapping(address => Vote) votesForSpecificRiskLimit;
        mapping(address => Vote) votesForSpendAllowance;
        Vote votesForDefaultRiskLimit;
        Vote votesForRiskLimitTimeWindow;
    }
    mapping(address => VoteRecords) public voteRecords;

    event DefaultRiskLimitChanged(
        address account,
        uint256 oldLimit,
        uint256 newLimit
    );
    event SpecificRiskLimitChanged(
        address account,
        address token,
        uint256 oldLimit,
        uint256 newLimit
    );
    event RiskLimitTimeWindowChanged(
        address account,
        uint256 oldTimeWindow,
        uint256 newTimeWindow
    );
    event ImmediateSpendAllowed(address account, address token, uint256 amount);
    event TimeDelayedSpendAllowed(
        address account,
        address token,
        uint256 amount,
        uint256 validFromTimestamp
    );
    event VoteForNewDefaultRiskLimit(
        address account,
        address voter,
        uint256 newLimit
    );
    event VoteForNewSpecificRiskLimit(
        address account,
        address voter,
        address token,
        uint256 newLimit
    );
    event VoteForNewRiskLimitTimeWindow(
        address account,
        address voter,
        uint256 newTimeWindow
    );
    event VoteForSpendAllowance(
        address account,
        address voter,
        address token,
        uint256 amount
    );

    struct Vote {
        uint256 proposedValue;
        address[] voted;
        uint16 count;
    }

    GuardianRegistry public guardianRegistry;

    function resetVote(Vote storage _vote, uint16 _numVotesRequired) internal {
        _vote.count = 0;
        _vote.voted = new address[](_numVotesRequired);
        _vote.proposedValue = 0;
    }

    function processVote(
        Vote storage _vote,
        uint256 _proposedValue,
        address voter,
        uint16 _numVotesRequired
    ) internal {
        if (_vote.proposedValue != _proposedValue) {
            resetVote(_vote, _numVotesRequired);
            _vote.proposedValue = _proposedValue;
            _vote.voted[0] = voter;
            _vote.count++;
            return;
        }
        for (uint16 i = 0; i < _numVotesRequired; i++) {
            if (_vote.voted[i] == address(0)) {
                _vote.voted[i] = voter;
                _vote.count++;
                break;
            }
            if (_vote.voted[i] == voter) {
                break;
            }
        }
    }

    constructor(GuardianRegistry _guardianRegistry) {
        require(
            address(_guardianRegistry) != address(0),
            "RiskManager: GuardianRegistry cannot be the zero address"
        );
        guardianRegistry = _guardianRegistry;
    }

    modifier onlyGuardian(address _account) {
        require(
            guardianRegistry.isGuardianFor(_account, msg.sender),
            "RiskManager: caller is not a guardian"
        );
        _;
    }

    modifier onlyIfNoApprovalsNeeded(address _account) {
        require(
            _getVoteRecord(_account).numVotesRequired == 0,
            "RiskManager: This action can only be performed via the guardians voting"
        );
        _;
    }

    modifier isInitialised(address _account) {
        require(
            _getVoteRecord(_account).initialised,
            "RiskManager: Risk parameters not initialised for account"
        );
        _;
    }

    function initialiseRiskParams(
        address _account,
        uint256 _riskLimitTimeWindow,
        uint256 _defaultRiskLimit,
        uint16 _numVotesRequired
    ) external {
        VoteRecords storage accountVotes = _getVoteRecord(_account);
        require(
            !accountVotes.initialised,
            "Risk parameters already set - use other methods to adjust them"
        );
        uint256 _numGuardians = guardianRegistry.getGuardianCountFor(_account);
        require(
            _numVotesRequired <= _numGuardians,
            "RiskManager: Number of votes required exceeds number of guardians"
        );
        if (_numVotesRequired == 0 && _numGuardians > 0) {
            revert(
                "RiskManager: Guardians should be removed if zero votes required"
            );
        }
        accountVotes.initialised = true;
        accountVotes.numVotesRequired = _numVotesRequired;
        _setRiskLimitTimeWindow(_account, _riskLimitTimeWindow);
        _setDefaultRiskLimit(_account, _defaultRiskLimit);
    }

    function _getVoteRecord(
        address _account
    ) internal view returns (VoteRecords storage) {
        return voteRecords[_account];
    }

    /**
    Msg sender is allowed to immediately decrease their own default spending limit, since this
    is a risk reduction operation.
     */
    function decreaseSpecificRiskLimit(
        address _token,
        uint256 _newLimit
    ) external isInitialised(msg.sender) {
        address _account = msg.sender;
        uint256 tokenLimit = limitForToken(_account, _token);
        // solhint-disable-next-line reason-string
        require(
            tokenLimit > _newLimit,
            "RiskManager: Cannot immediately increase risk limit, need guardians approval"
        );
        _setSpecificRiskLimit(_account, _token, _newLimit);
        emit SpecificRiskLimitChanged(_account, _token, tokenLimit, _newLimit);
    }

    /**
    Msg sender is allowed to immediately decrease the spending limit on their account 
    for a token, since this
    is a risk reduction operation.
     */
    function decreaseDefaultRiskLimit(
        uint256 _newLimit
    ) external isInitialised(msg.sender) {
        // solhint-disable-next-line reason-string
        address _account = msg.sender;
        uint256 oldLimit = defaultRiskLimit(_account);
        require(
            _newLimit < oldLimit,
            "RiskManager: Cannot immediately increase risk limit, need guardians approval"
        );
        _setDefaultRiskLimit(_account, _newLimit);
        emit DefaultRiskLimitChanged(_account, oldLimit, _newLimit);
    }

    /**
    Msg sender is allowed to immediately increase the time window for spend measurement, 
    on their account, since this
    is a risk reduction operation.
     */
    function increaseRiskLimitTimeWindow(
        uint256 _newTimeWindow
    ) external isInitialised(msg.sender) {
        address _account = msg.sender;
        // solhint-disable-next-line reason-string
        uint256 oldTimeWindow = riskLimitTimeWindow(_account);
        require(
            _newTimeWindow > oldTimeWindow,
            "RiskManager: Cannot immediately decrease time window, needs guardians approval"
        );
        _setRiskLimitTimeWindow(_account, _newTimeWindow);
        emit RiskLimitTimeWindowChanged(
            _account,
            oldTimeWindow,
            _newTimeWindow
        );
    }

    /**
    Msg sender is ONLY allowed to immediately increase the spending limit on their account
    for a token, if no votes are required from guardians.
     */
    function increaseSpecificRiskLimit(
        address _token,
        uint256 _newLimit
    ) external onlyIfNoApprovalsNeeded(msg.sender) isInitialised(msg.sender) {
        address _account = msg.sender;
        uint256 tokenLimit = limitForToken(_account, _token);
        require(_newLimit > tokenLimit, "Risk limit not increased");
        _setSpecificRiskLimit(_account, _token, _newLimit);
        emit SpecificRiskLimitChanged(_account, _token, tokenLimit, _newLimit);
    }

    /**
    Msg sender is ONLY allowed to immediately increase the default spending limit, 
    on their account if no votes are required from guardians.
     */
    function increaseDefaultRiskLimit(
        uint256 _newLimit
    ) external onlyIfNoApprovalsNeeded(msg.sender) isInitialised(msg.sender) {
        address _account = msg.sender;
        uint256 oldLimit = defaultRiskLimit(_account);

        require(_newLimit > oldLimit, "Risk limit not increased");
        _setDefaultRiskLimit(_account, _newLimit);
        emit DefaultRiskLimitChanged(_account, oldLimit, _newLimit);
    }

    /**
    Msg sender is allowed to pre-approve an allowance to spend on their account 
    above the risk limit, as long as it applies after a full time window's delay
     */
    function allowTimeDelayedTransaction(
        address _token,
        uint256 _amount,
        uint256 _validFromTimestamp
    ) external isInitialised(msg.sender) {
        address _account = msg.sender;

        uint _riskLimitWindow = riskLimitTimeWindow(_account);
        require(_riskLimitWindow > 0, "Risk limits are disabled");
        require(
            _validFromTimestamp > block.timestamp + _riskLimitWindow,
            "Transaction is not delayed by a full risk measurement time window"
        );
        require(
            _amount > limitForToken(_account, _token),
            "Transaction amount is not above the risk limit"
        );
        _addAllowance(_account, _token, _amount, _validFromTimestamp);
        emit TimeDelayedSpendAllowed(
            _account,
            _token,
            _amount,
            _validFromTimestamp
        );
    }

    /**
    Msg sender is ONLY allowed to immediately decrease the time window for spend measurement
    on their account, if no votes are required from guardians.
     */
    function decreaseRiskLimitTimeWindow(
        uint256 _newTimeWindow
    ) external onlyIfNoApprovalsNeeded(msg.sender) isInitialised(msg.sender) {
        address _account = msg.sender;
        uint256 oldTimeWindow = riskLimitTimeWindow(_account);
        require(_newTimeWindow < oldTimeWindow, "Time window not decreased");
        _setRiskLimitTimeWindow(_account, _newTimeWindow);
        emit RiskLimitTimeWindowChanged(
            _account,
            oldTimeWindow,
            _newTimeWindow
        );
    }

    function voteForSpecificRiskLimitIncrease(
        address _account,
        address _token,
        uint256 _newLimit
    ) external onlyGuardian(_account) isInitialised(_account) {
        uint256 oldLimit = limitForToken(_account, _token);
        require(_newLimit > oldLimit, "Specific risk limit not increased");
        VoteRecords storage accountVotes = _getVoteRecord(_account);
        mapping(address => Vote)
            storage votesForSpecificRiskLimit = accountVotes
                .votesForSpecificRiskLimit;
        processVote(
            votesForSpecificRiskLimit[_token],
            _newLimit,
            msg.sender,
            accountVotes.numVotesRequired
        );
        emit VoteForNewSpecificRiskLimit(
            _account,
            msg.sender,
            _token,
            _newLimit
        );

        if (
            votesForSpecificRiskLimit[_token].count ==
            accountVotes.numVotesRequired
        ) {
            _setSpecificRiskLimit(_account, _token, _newLimit);
            resetVote(
                votesForSpecificRiskLimit[_token],
                accountVotes.numVotesRequired
            );
            emit SpecificRiskLimitChanged(
                _account,
                _token,
                oldLimit,
                _newLimit
            );
        }
    }

    function voteForDefaultRiskLimitIncrease(
        address _account,
        uint256 _newLimit
    ) external onlyGuardian(_account) isInitialised(_account) {
        uint256 oldLimit = defaultRiskLimit(_account);
        require(_newLimit > oldLimit, "Default risk limit not increased");
        VoteRecords storage accountVotes = _getVoteRecord(_account);
        Vote storage votesForDefaultRiskLimit = accountVotes
            .votesForDefaultRiskLimit;
        processVote(
            votesForDefaultRiskLimit,
            _newLimit,
            msg.sender,
            accountVotes.numVotesRequired
        );
        emit VoteForNewDefaultRiskLimit(_account, msg.sender, _newLimit);

        if (votesForDefaultRiskLimit.count == accountVotes.numVotesRequired) {
            _setDefaultRiskLimit(_account, _newLimit);
            resetVote(votesForDefaultRiskLimit, accountVotes.numVotesRequired);
            emit DefaultRiskLimitChanged(_account, oldLimit, _newLimit);
        }
    }

    function voteForRiskLimitTimeWindowDecrease(
        address _account,
        uint256 _newTimeWindow
    ) external onlyGuardian(_account) isInitialised(_account) {
        uint256 oldTimeWindow = riskLimitTimeWindow(_account);
        require(_newTimeWindow < oldTimeWindow, "Time window not decreased");
        VoteRecords storage accountVotes = _getVoteRecord(_account);
        Vote storage votesForRiskLimitTimeWindow = accountVotes
            .votesForRiskLimitTimeWindow;
        processVote(
            votesForRiskLimitTimeWindow,
            _newTimeWindow,
            msg.sender,
            accountVotes.numVotesRequired
        );
        emit VoteForNewRiskLimitTimeWindow(
            _account,
            msg.sender,
            _newTimeWindow
        );

        if (
            votesForRiskLimitTimeWindow.count == accountVotes.numVotesRequired
        ) {
            _setRiskLimitTimeWindow(_account, _newTimeWindow);
            resetVote(
                votesForRiskLimitTimeWindow,
                accountVotes.numVotesRequired
            );
            emit RiskLimitTimeWindowChanged(
                _account,
                oldTimeWindow,
                _newTimeWindow
            );
        }
    }

    function voteForSpendAllowance(
        address _account,
        address _token,
        uint256 _amount
    ) external onlyGuardian(_account) isInitialised(_account) {
        uint256 _riskLimitWindow = riskLimitTimeWindow(_account);
        require(_riskLimitWindow > 0, "Risk limits are disabled");
        require(
            _amount > limitForToken(_account, _token),
            "Transaction amount is not above the risk limit"
        );
        VoteRecords storage accountVotes = _getVoteRecord(_account);
        mapping(address => Vote) storage votesForSpendAllowance = accountVotes
            .votesForSpendAllowance;
        processVote(
            votesForSpendAllowance[_token],
            _amount,
            msg.sender,
            accountVotes.numVotesRequired
        );
        emit VoteForSpendAllowance(_account, msg.sender, _token, _amount);

        if (
            votesForSpendAllowance[_token].count ==
            accountVotes.numVotesRequired
        ) {
            _addAllowance(_account, _token, _amount, block.timestamp);
            resetVote(
                votesForSpendAllowance[_token],
                accountVotes.numVotesRequired
            );
            emit ImmediateSpendAllowed(_account, _token, _amount);
        }
    }

    /**
    Only message sender can track spend against their own account (this
    updates the spending records as long as no reverts are triggered due to going
    beyond limits)
     */
    function trackSpend(
        address _token,
        uint256 _amount
    ) external isInitialised(msg.sender) {
        address _account = msg.sender;
        _checkRiskLimit(_account, _token, _amount);
    }

    function numVotesRequired(address _account) external view returns (uint16) {
        return _getVoteRecord(_account).numVotesRequired;
    }
}
