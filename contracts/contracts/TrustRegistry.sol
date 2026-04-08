// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "./RoutePassport.sol";

/// @title TrustRegistry
/// @notice Manages Trust Stamps between travelers and hosts.
///         On-chain stores a verification hash; full comments live on IPFS.
contract TrustRegistry {
    RoutePassport public immutable routePassport;

    uint256 private _nextStampId;

    struct Stamp {
        uint256 stampId;
        address traveler;
        address host;
        uint256 routeId;          // NFT tokenId of the minted route
        bytes32 verificationHash; // keccak256(traveler || host || block.timestamp || geohash)
        string  commentIpfsCid;   // optional — empty string if no comment
        uint64  timestamp;
    }

    // stampId => Stamp
    mapping(uint256 => Stamp) public stamps;
    // user => total stamps received
    mapping(address => uint256) public reputationScore;
    // traveler => host => routeId => already stamped (prevent double-stamp same trip)
    mapping(address => mapping(address => mapping(uint256 => bool))) private _alreadyStamped;

    event StampIssued(
        uint256 indexed stampId,
        address indexed traveler,
        address indexed host,
        uint256 routeId,
        bytes32 verificationHash
    );

    constructor(address routePassportAddress) {
        routePassport = RoutePassport(routePassportAddress);
    }

    /// @notice Issue a Trust Stamp. Caller must be the traveler.
    /// @param host          Address of the host being stamped.
    /// @param routeId       NFT tokenId of the route that includes this stop.
    /// @param geohash       Approximate geohash of the meeting location (precision level set by client).
    /// @param commentCid    IPFS CID of the off-chain comment (empty string = no comment).
    function issueStamp(
        address host,
        uint256 routeId,
        string calldata geohash,
        string calldata commentCid
    ) external returns (uint256) {
        require(host != msg.sender, "Cannot stamp yourself");
        require(
            routePassport.hasMintedRoute(msg.sender),
            "Anti-sybil: mint at least one route before issuing stamps"
        );
        require(
            !_alreadyStamped[msg.sender][host][routeId],
            "Already stamped this host for this route"
        );

        bytes32 vh = keccak256(
            abi.encodePacked(msg.sender, host, block.timestamp, geohash)
        );

        uint256 stampId = ++_nextStampId;
        stamps[stampId] = Stamp({
            stampId:          stampId,
            traveler:         msg.sender,
            host:             host,
            routeId:          routeId,
            verificationHash: vh,
            commentIpfsCid:   commentCid,
            timestamp:        uint64(block.timestamp)
        });

        reputationScore[host]++;
        _alreadyStamped[msg.sender][host][routeId] = true;

        emit StampIssued(stampId, msg.sender, host, routeId, vh);
        return stampId;
    }

    /// @notice Get reputation score of a user (total stamps received as host).
    function getReputation(address user) external view returns (uint256) {
        return reputationScore[user];
    }

    /// @notice Get a stamp by ID.
    function getStamp(uint256 stampId) external view returns (Stamp memory) {
        return stamps[stampId];
    }

    /// @notice Total stamps ever issued.
    function totalStamps() external view returns (uint256) {
        return _nextStampId;
    }
}
