pragma solidity ^0.8.24;

import { FHE, euint32, externalEuint32 } from "@fhevm/solidity/lib/FHE.sol";
import { ZamaEthereumConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract PrivateRegistry is ZamaEthereumConfig {
    struct RegistryEntry {
        string identifier;             
        euint32 encryptedAmount;      
        uint256 publicAttribute1;     
        uint256 publicAttribute2;     
        string description;           
        address contributor;          
        uint256 timestamp;            
        uint32 decryptedAmount;       
        bool isClaimed;               
    }

    mapping(string => RegistryEntry) public registryEntries;
    string[] public entryIds;

    event EntryCreated(string indexed entryId, address indexed contributor);
    event ClaimVerified(string indexed entryId, uint32 decryptedAmount);

    constructor() ZamaEthereumConfig() {
    }

    function createEntry(
        string calldata entryId,
        string calldata identifier,
        externalEuint32 encryptedAmount,
        bytes calldata inputProof,
        uint256 publicAttribute1,
        uint256 publicAttribute2,
        string calldata description
    ) external {
        require(bytes(registryEntries[entryId].identifier).length == 0, "Entry already exists");
        require(FHE.isInitialized(FHE.fromExternal(encryptedAmount, inputProof)), "Invalid encrypted input");

        registryEntries[entryId] = RegistryEntry({
            identifier: identifier,
            encryptedAmount: FHE.fromExternal(encryptedAmount, inputProof),
            publicAttribute1: publicAttribute1,
            publicAttribute2: publicAttribute2,
            description: description,
            contributor: msg.sender,
            timestamp: block.timestamp,
            decryptedAmount: 0,
            isClaimed: false
        });

        FHE.allowThis(registryEntries[entryId].encryptedAmount);
        FHE.makePubliclyDecryptable(registryEntries[entryId].encryptedAmount);
        entryIds.push(entryId);

        emit EntryCreated(entryId, msg.sender);
    }

    function verifyClaim(
        string calldata entryId, 
        bytes memory abiEncodedClearValue,
        bytes memory decryptionProof
    ) external {
        require(bytes(registryEntries[entryId].identifier).length > 0, "Entry does not exist");
        require(!registryEntries[entryId].isClaimed, "Entry already claimed");

        bytes32[] memory cts = new bytes32[](1);
        cts[0] = FHE.toBytes32(registryEntries[entryId].encryptedAmount);

        FHE.checkSignatures(cts, abiEncodedClearValue, decryptionProof);
        uint32 decodedValue = abi.decode(abiEncodedClearValue, (uint32));

        registryEntries[entryId].decryptedAmount = decodedValue;
        registryEntries[entryId].isClaimed = true;

        emit ClaimVerified(entryId, decodedValue);
    }

    function getEncryptedAmount(string calldata entryId) external view returns (euint32) {
        require(bytes(registryEntries[entryId].identifier).length > 0, "Entry does not exist");
        return registryEntries[entryId].encryptedAmount;
    }

    function getEntryDetails(string calldata entryId) external view returns (
        string memory identifier,
        uint256 publicAttribute1,
        uint256 publicAttribute2,
        string memory description,
        address contributor,
        uint256 timestamp,
        bool isClaimed,
        uint32 decryptedAmount
    ) {
        require(bytes(registryEntries[entryId].identifier).length > 0, "Entry does not exist");
        RegistryEntry storage entry = registryEntries[entryId];

        return (
            entry.identifier,
            entry.publicAttribute1,
            entry.publicAttribute2,
            entry.description,
            entry.contributor,
            entry.timestamp,
            entry.isClaimed,
            entry.decryptedAmount
        );
    }

    function getAllEntryIds() external view returns (string[] memory) {
        return entryIds;
    }

    function isOperational() public pure returns (bool) {
        return true;
    }
}


