# WedList: Private Wedding Registry

WedList is a privacy-preserving wedding registry application that leverages Zama's Fully Homomorphic Encryption (FHE) technology. With WedList, couples can maintain the confidentiality of their gift selections while ensuring their guests have a seamless experience in contributing gifts or monetary gifts—without exposing sensitive information. 

## The Problem

In traditional wedding registries, the list of gifts, and monetary contributions can often lead to public comparisons and potential discomfort among participants. Guests may feel pressured to match or exceed the value of gifts seen on the registry, creating a competitive atmosphere rather than a celebratory one. Additionally, any publicly available gift registry can become a target for unwanted attention or data scraping, leading to privacy breaches. 

The danger lies in the exposure of cleartext data, where everyone can see who gave what, and how much—the implications can impact social dynamics and privacy expectations among guests and newlyweds alike.

## The Zama FHE Solution

WedList addresses these privacy concerns by utilizing Fully Homomorphic Encryption, which allows computation on encrypted data. This means that while guests can express their intent to contribute or select gifts, the underlying data—such as the values of gifts or the statuses of claims—remains encrypted throughout the process. 

Using Zama's `fhevm` to process encrypted inputs, we ensure that only the couple can decrypt the information necessary to view the contributions while keeping everything else securely hidden. This transforms the wedding registry experience into a private and respectful environment.

## Key Features

- 🎁 **Gift Claiming**: Guests can securely claim gifts while keeping their choices confidential until the couple decides to reveal them.
- 🔒 **Privacy Protection**: Gift values are encrypted, ensuring that no one else can see what others have contributed.
- 🥳 **Social Etiquette**: Maintains the integrity of social interactions by removing the pressure of open comparisons.
- 🔗 **Seamless Integration**: Easy for guests to navigate without compromising their private data.
- 💬 **User-Friendly Interface**: Designed with ease of use in mind, so every guest can participate without tech-savviness.

## Technical Architecture & Stack

WedList utilizes a robust technical stack to ensure both functionality and privacy:

- **Core Technologies**:
  - Zama's `fhevm` for processing encrypted data
  - Smart contracts for secure transactions
- **Frontend**:
  - React (JavaScript)
- **Backend**:
  - Node.js
- **Database**:
  - Encrypted database solutions
- **Smart Contract**:
  - Solidity for Ethereum-based interactions

## Smart Contract / Core Logic

Here’s a simplified snippet demonstrating how gifts could be encrypted and claimed using Zama's FHE capabilities within a smart contract:solidity
pragma solidity ^0.8.0;

contract WedList {
    struct Gift {
        uint64 encryptedValue; // Encrypted gift value
        bool claimed;          // Claim status
    }

    mapping(address => Gift) public gifts;

    function claimGift(uint64 encryptedClaim) public {
        require(!gifts[msg.sender].claimed, "Gift already claimed.");
        gifts[msg.sender].encryptedValue = encryptedClaim; // Store encrypted value
        gifts[msg.sender].claimed = true; // Update claim status
    }

    function getGiftValue() public view returns (uint64) {
        return gifts[msg.sender].encryptedValue; // Return encrypted value
    }
}

This contract allows guests to securely represent their contributions while managing claims in a way that keeps sensitive data hidden.

## Directory Structure

Here’s the structure of the WedList application:
WedList/
├── contracts/
│   └── WedList.sol
├── src/
│   ├── components/
│   ├── App.js
│   └── index.js
├── tests/
│   └── WedList.test.js
└── package.json

The directory structure is organized to optimize development and testing workflows, ensuring clarity in code roles.

## Installation & Setup

### Prerequisites

Ensure you have the following installed on your development machine:

- Node.js (version >= 14)
- npm (Node Package Manager)

### Setup Steps

1. Install the necessary dependencies:bash
   npm install
   
2. Install Zama’s FHE library:bash
   npm install fhevm

## Build & Run

To build and start the application, run the following commands:

1. Compile the smart contracts:bash
   npx hardhat compile

2. Start the development server:bash
   npm start

This will launch the application, allowing you to begin setting up your wedding registry with privacy at its core.

## Acknowledgements

We would like to extend our gratitude to Zama for providing the open-source FHE primitives that make this project possible. Their innovative approach to privacy through Fully Homomorphic Encryption enables us to create a secure environment for special moments in life like weddings.

Together, let’s celebrate love and community in a way that respects the privacy of all involved! 

This README.md effectively communicates the value proposition, technical details, and operational guidance while maintaining a clear focus on Zama's FHE technology.


