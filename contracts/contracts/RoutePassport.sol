// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title RoutePassport
/// @notice Mints travel routes as NFTs and tracks provenance for replicas.
contract RoutePassport is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // tokenId => original tokenId (0 if original)
    mapping(uint256 => uint256) public originalRouteId;
    // tokenId => number of times this route has been replicated
    mapping(uint256 => uint256) public replicaCount;
    // tokenId => creator address
    mapping(uint256 => address) public routeCreator;

    event RouteMinted(
        uint256 indexed tokenId,
        address indexed creator,
        string ipfsHash,
        uint256 originalId
    );
    event RouteReplicated(
        uint256 indexed newTokenId,
        uint256 indexed originalTokenId,
        address indexed replicator
    );

    constructor(address initialOwner) ERC721("CouchChain RoutePassport", "CCRP") Ownable(initialOwner) {}

    /// @notice Mint a new original route NFT.
    /// @param ipfsHash IPFS CID of the route metadata JSON.
    function createRoute(string calldata ipfsHash) external returns (uint256) {
        uint256 tokenId = ++_nextTokenId;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, string(abi.encodePacked("ipfs://", ipfsHash)));
        routeCreator[tokenId] = msg.sender;
        originalRouteId[tokenId] = 0; // 0 means it IS the original
        emit RouteMinted(tokenId, msg.sender, ipfsHash, 0);
        return tokenId;
    }

    /// @notice Replicate an existing route, preserving provenance.
    /// @param sourceTokenId The original (or replicated) route to clone.
    /// @param ipfsHash IPFS CID of the (possibly modified) route metadata.
    function replicateRoute(uint256 sourceTokenId, string calldata ipfsHash)
        external
        returns (uint256)
    {
        require(_ownerOf(sourceTokenId) != address(0), "Source route does not exist");

        uint256 origin = originalRouteId[sourceTokenId] == 0
            ? sourceTokenId
            : originalRouteId[sourceTokenId];

        uint256 tokenId = ++_nextTokenId;
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, string(abi.encodePacked("ipfs://", ipfsHash)));
        routeCreator[tokenId] = msg.sender;
        originalRouteId[tokenId] = origin;
        replicaCount[origin]++;

        emit RouteReplicated(tokenId, origin, msg.sender);
        emit RouteMinted(tokenId, msg.sender, ipfsHash, origin);
        return tokenId;
    }

    /// @notice Returns the total number of routes minted.
    function totalRoutes() external view returns (uint256) {
        return _nextTokenId;
    }

    /// @notice Check if an address has minted at least one route (anti-sybil gate for stamps).
    function hasMintedRoute(address user) external view returns (bool) {
        return balanceOf(user) > 0;
    }
}
