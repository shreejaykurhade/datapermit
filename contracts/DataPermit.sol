// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @notice Payment and future-access registry. Off-chain gateway enforces request quotas.
contract DataPermit {
    struct Dataset { address publisher; uint256 price; uint64 duration; uint32 quota; bytes32 contentHash; bytes32 termsHash; }
    struct Permit { address buyer; bytes32 datasetId; uint64 expiresAt; uint32 quota; bool revoked; }
    IERC20 public immutable token;
    mapping(bytes32 => Dataset) public datasets;
    mapping(uint256 => Permit) public permits;
    struct Version {bytes32 familyId; bytes32 versionHash;}
    struct Share {address recipient; uint16 bps; uint8 role;}
    mapping(bytes32=>address) public datasetOwners;
    mapping(bytes32=>Version) public versions;
    mapping(bytes32=>Share[]) private shares;
    mapping(address=>uint256) public earnings;
    uint256 public totalLiability;
    uint256 public constant MAX_RECIPIENTS=20;
    uint256 public nextPermitId;
    bool private entered;
    event DatasetRegistered(bytes32 indexed datasetId, address indexed publisher, bytes32 contentHash, bytes32 termsHash);
    event PermitPurchased(uint256 indexed permitId, bytes32 indexed datasetId, address indexed buyer, address publisher, uint256 amount, uint64 expiresAt, uint32 quota);
    event PermitRevoked(uint256 indexed permitId);
    event VersionRegistered(bytes32 indexed datasetId,bytes32 indexed familyId,bytes32 versionHash,address company,address[] recipients,uint16[] basisPoints,uint8[] roles);
    event EarningsWithdrawn(address indexed recipient,uint256 amount);
    modifier nonReentrant(){require(!entered,"reentrant");entered=true;_;entered=false;}
    constructor(address paymentToken) { require(paymentToken != address(0), "token required"); token = IERC20(paymentToken); }
    function registerDataset(bytes32 id, uint256 price, uint64 duration, uint32 quota, bytes32 contentHash, bytes32 termsHash) external {
        require(datasetOwners[id]==address(0)||datasetOwners[id]==msg.sender,"not company owner");
        require(datasets[id].publisher == address(0), "version already registered");
        require(price > 0 && duration > 0 && duration <= 365 days && quota > 0, "invalid terms");
        datasets[id] = Dataset(msg.sender, price, duration, quota, contentHash, termsHash);
        emit DatasetRegistered(id, msg.sender, contentHash, termsHash);
        datasetOwners[id]=msg.sender;
        versions[id]=Version(id,bytes32(0));
    }
    /// @notice Company gets the remainder; roles: 1 contributor, 2 expert verifier.
    function registerVersion(bytes32 familyId,bytes32 versionHash,uint256 price,uint64 duration,uint32 quota,bytes32 contentHash,bytes32 termsHash,address[] calldata recipients,uint16[] calldata basisPoints,uint8[] calldata roles) external returns(bytes32 id){
        require(familyId!=bytes32(0)&&versionHash!=bytes32(0),"identifier required");
        require(datasetOwners[familyId]==address(0)||datasetOwners[familyId]==msg.sender,"not company owner");
        require(recipients.length<=MAX_RECIPIENTS&&recipients.length==basisPoints.length&&recipients.length==roles.length,"invalid shares");
        id=keccak256(abi.encode(familyId,versionHash));
        require(datasets[id].publisher==address(0),"version already registered");
        require(price>0&&duration>0&&duration<=365 days&&quota>0&&contentHash!=bytes32(0)&&termsHash!=bytes32(0),"invalid terms");
        uint256 total;
        for(uint256 i=0;i<recipients.length;i++){
            require(recipients[i]!=address(0)&&recipients[i]!=msg.sender&&basisPoints[i]>0&&(roles[i]==1||roles[i]==2),"invalid recipient");
            if(i>0)require(uint160(recipients[i-1])<uint160(recipients[i]),"recipients must be sorted");
            total+=basisPoints[i];shares[id].push(Share(recipients[i],basisPoints[i],roles[i]));
        }
        require(total<=10000,"shares exceed 100 percent");
        datasetOwners[familyId]=msg.sender;versions[id]=Version(familyId,versionHash);
        datasets[id]=Dataset(msg.sender,price,duration,quota,contentHash,termsHash);
        emit DatasetRegistered(id,msg.sender,contentHash,termsHash);
        emit VersionRegistered(id,familyId,versionHash,msg.sender,recipients,basisPoints,roles);
    }
    function getShares(bytes32 id) external view returns(Share[] memory){return shares[id];}
    function purchase(bytes32 datasetId, bytes32 acceptedTermsHash) external nonReentrant returns(uint256 id) {
        Dataset memory d = datasets[datasetId];
        require(d.publisher != address(0) && d.termsHash == acceptedTermsHash, "invalid dataset or terms");
        id = ++nextPermitId;
        uint64 expiry = uint64(block.timestamp + d.duration);
        permits[id] = Permit(msg.sender, datasetId, expiry, d.quota, false);
        uint256 balanceBefore=token.balanceOf(address(this));
        require(token.transferFrom(msg.sender,address(this),d.price),"payment failed");
        require(token.balanceOf(address(this))==balanceBefore+d.price,"unsupported payment token");
        uint256 distributed;
        for(uint256 i=0;i<shares[datasetId].length;i++){
            Share memory share=shares[datasetId][i];
            uint256 amount=(d.price/10000)*share.bps+((d.price%10000)*share.bps)/10000;
            earnings[share.recipient]+=amount;distributed+=amount;
        }
        earnings[d.publisher]+=d.price-distributed;totalLiability+=d.price;
        emit PermitPurchased(id, datasetId, msg.sender, d.publisher, d.price, expiry, d.quota);
    }
    function withdrawEarnings() external nonReentrant {
        uint256 amount=earnings[msg.sender];require(amount>0,"no earnings");
        earnings[msg.sender]=0;totalLiability-=amount;
        require(token.transfer(msg.sender,amount),"withdrawal failed");
        emit EarningsWithdrawn(msg.sender,amount);
    }
    function revoke(uint256 id) external {
        Permit storage p = permits[id];
        require(p.buyer != address(0), "unknown permit");
        require(msg.sender == p.buyer || msg.sender == datasets[p.datasetId].publisher, "not authorized");
        p.revoked = true; emit PermitRevoked(id);
    }
}
