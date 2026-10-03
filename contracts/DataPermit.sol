// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
}

/// @notice Payment and future-access registry. Off-chain gateway enforces request quotas.
contract DataPermit {
    struct Dataset { address publisher; uint256 price; uint64 duration; uint32 quota; bytes32 contentHash; bytes32 termsHash; }
    struct Permit { address buyer; bytes32 datasetId; uint64 expiresAt; uint32 quota; bool revoked; }
    IERC20 public immutable token;
    mapping(bytes32 => Dataset) public datasets;
    mapping(uint256 => Permit) public permits;
    uint256 public nextPermitId;
    bool private entered;
    event DatasetRegistered(bytes32 indexed datasetId, address indexed publisher, bytes32 contentHash, bytes32 termsHash);
    event PermitPurchased(uint256 indexed permitId, bytes32 indexed datasetId, address indexed buyer, address publisher, uint256 amount, uint64 expiresAt, uint32 quota);
    event PermitRevoked(uint256 indexed permitId);
    constructor(address paymentToken) { require(paymentToken != address(0), "token required"); token = IERC20(paymentToken); }
    function registerDataset(bytes32 id, uint256 price, uint64 duration, uint32 quota, bytes32 contentHash, bytes32 termsHash) external {
        require(datasets[id].publisher == address(0), "version already registered");
        require(price > 0 && duration > 0 && duration <= 365 days && quota > 0, "invalid terms");
        datasets[id] = Dataset(msg.sender, price, duration, quota, contentHash, termsHash);
        emit DatasetRegistered(id, msg.sender, contentHash, termsHash);
    }
    function purchase(bytes32 datasetId, bytes32 acceptedTermsHash) external returns(uint256 id) {
        require(!entered, "reentrant"); entered = true;
        Dataset memory d = datasets[datasetId];
        require(d.publisher != address(0) && d.termsHash == acceptedTermsHash, "invalid dataset or terms");
        id = ++nextPermitId;
        uint64 expiry = uint64(block.timestamp + d.duration);
        permits[id] = Permit(msg.sender, datasetId, expiry, d.quota, false);
        require(token.transferFrom(msg.sender, d.publisher, d.price), "payment failed");
        emit PermitPurchased(id, datasetId, msg.sender, d.publisher, d.price, expiry, d.quota);
        entered = false;
    }
    function revoke(uint256 id) external {
        Permit storage p = permits[id];
        require(p.buyer != address(0), "unknown permit");
        require(msg.sender == p.buyer || msg.sender == datasets[p.datasetId].publisher, "not authorized");
        p.revoked = true; emit PermitRevoked(id);
    }
}
