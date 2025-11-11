import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';

interface GiftItem {
  id: string;
  name: string;
  description: string;
  encryptedAmount: string;
  publicValue1: number;
  publicValue2: number;
  creator: string;
  timestamp: number;
  isVerified?: boolean;
  decryptedValue?: number;
  claimedBy?: string;
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingGift, setCreatingGift] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending", 
    message: "" 
  });
  const [newGiftData, setNewGiftData] = useState({ name: "", description: "", amount: "" });
  const [selectedGift, setSelectedGift] = useState<GiftItem | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterClaimed, setFilterClaimed] = useState(false);
  const [userHistory, setUserHistory] = useState<string[]>([]);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting } = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        console.log('Initializing FHEVM for wedding registry...');
        await initialize();
        console.log('FHEVM initialized successfully');
      } catch (error) {
        console.error('Failed to initialize FHEVM:', error);
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM initialization failed" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadGifts();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadGifts = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const giftsList: GiftItem[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          giftsList.push({
            id: businessId,
            name: businessData.name,
            description: businessData.description,
            encryptedAmount: businessId,
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            creator: businessData.creator,
            timestamp: Number(businessData.timestamp),
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0,
            claimedBy: businessData.publicValue2 > 0 ? "Claimed" : "Available"
          });
        } catch (e) {
          console.error('Error loading gift data:', e);
        }
      }
      
      setGifts(giftsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Failed to load gifts" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const createGift = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setCreatingGift(true);
    setTransactionStatus({ visible: true, status: "pending", message: "Creating gift with FHE encryption..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("Failed to get contract with signer");
      
      const amountValue = parseInt(newGiftData.amount) || 0;
      const businessId = `gift-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, amountValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        newGiftData.name,
        encryptedResult.encryptedData,
        encryptedResult.proof,
        0,
        0,
        newGiftData.description
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Waiting for transaction..." });
      await tx.wait();
      
      setUserHistory(prev => [...prev, `Created gift: ${newGiftData.name}`]);
      setTransactionStatus({ visible: true, status: "success", message: "Gift created successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadGifts();
      setShowCreateModal(false);
      setNewGiftData({ name: "", description: "", amount: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "Transaction rejected" 
        : "Creation failed: " + (e.message || "Unknown error");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setCreatingGift(false); 
    }
  };

  const decryptGift = async (giftId: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "Please connect wallet first" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const giftData = await contractRead.getBusinessData(giftId);
      if (giftData.isVerified) {
        const storedValue = Number(giftData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Gift amount already verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(giftId);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(giftId, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "Verifying decryption..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadGifts();
      setUserHistory(prev => [...prev, `Decrypted gift: ${selectedGift?.name}`]);
      
      setTransactionStatus({ visible: true, status: "success", message: "Gift amount decrypted successfully!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "Gift amount is already verified" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadGifts();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "Decryption failed: " + (e.message || "Unknown error") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const claimGift = async (giftId: string) => {
    if (!isConnected) return;
    
    setTransactionStatus({ visible: true, status: "pending", message: "Claiming gift..." });
    
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const isAvailable = await contract.isAvailable();
      if (isAvailable) {
        setUserHistory(prev => [...prev, `Claimed gift: ${gifts.find(g => g.id === giftId)?.name}`]);
        setTransactionStatus({ visible: true, status: "success", message: "Gift claimed successfully!" });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 2000);
      }
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "Claim failed" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    }
  };

  const filteredGifts = gifts.filter(gift => {
    const matchesSearch = gift.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         gift.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = !filterClaimed || gift.publicValue2 === 0;
    return matchesSearch && matchesFilter;
  });

  const stats = {
    totalGifts: gifts.length,
    claimedGifts: gifts.filter(g => g.publicValue2 > 0).length,
    totalValue: gifts.reduce((sum, g) => sum + (g.decryptedValue || 0), 0),
    availableGifts: gifts.filter(g => g.publicValue2 === 0).length
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>WedList Z 🔐</h1>
            <span>Private Wedding Registry</span>
          </div>
          <div className="header-actions">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">💍</div>
            <h2>Connect Your Wallet to Access Wedding Registry</h2>
            <p>Secure, private gift registry with fully homomorphic encryption</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>Connect wallet to initialize FHE system</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>View encrypted gift registry</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>Claim gifts with privacy protection</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>Initializing FHE Encryption System...</p>
        <p className="loading-note">Securing your wedding registry</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>Loading wedding registry...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>WedList Z 🔐</h1>
          <span>Encrypted Wedding Registry</span>
        </div>
        
        <div className="header-actions">
          <button onClick={() => setShowCreateModal(true)} className="create-btn">
            + Add Gift
          </button>
          <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
        </div>
      </header>
      
      <div className="main-content">
        <div className="stats-panel">
          <div className="stat-card">
            <div className="stat-icon">🎁</div>
            <div className="stat-info">
              <div className="stat-value">{stats.totalGifts}</div>
              <div className="stat-label">Total Gifts</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">✅</div>
            <div className="stat-info">
              <div className="stat-value">{stats.claimedGifts}</div>
              <div className="stat-label">Claimed</div>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🔓</div>
            <div className="stat-info">
              <div className="stat-value">{stats.availableGifts}</div>
              <div className="stat-label">Available</div>
            </div>
          </div>
        </div>

        <div className="search-section">
          <div className="search-bar">
            <input 
              type="text" 
              placeholder="Search gifts..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <span className="search-icon">🔍</span>
          </div>
          <label className="filter-toggle">
            <input 
              type="checkbox" 
              checked={filterClaimed}
              onChange={(e) => setFilterClaimed(e.target.checked)}
            />
            Show available only
          </label>
          <button onClick={loadGifts} className="refresh-btn" disabled={isRefreshing}>
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="gifts-grid">
          {filteredGifts.length === 0 ? (
            <div className="no-gifts">
              <p>No gifts found</p>
              <button onClick={() => setShowCreateModal(true)} className="create-btn">
                Add First Gift
              </button>
            </div>
          ) : (
            filteredGifts.map((gift, index) => (
              <div className="gift-card" key={index} onClick={() => setSelectedGift(gift)}>
                <div className="gift-header">
                  <h3>{gift.name}</h3>
                  <span className={`status-badge ${gift.publicValue2 > 0 ? 'claimed' : 'available'}`}>
                    {gift.publicValue2 > 0 ? 'Claimed' : 'Available'}
                  </span>
                </div>
                <p className="gift-description">{gift.description}</p>
                <div className="gift-footer">
                  <div className="gift-amount">
                    {gift.isVerified ? `$${gift.decryptedValue}` : '🔒 Encrypted'}
                  </div>
                  <button 
                    className={`claim-btn ${gift.publicValue2 > 0 ? 'claimed' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      gift.publicValue2 > 0 ? {} : claimGift(gift.id);
                    }}
                    disabled={gift.publicValue2 > 0}
                  >
                    {gift.publicValue2 > 0 ? 'Claimed' : 'Claim Gift'}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="history-panel">
          <h3>Your Activity</h3>
          <div className="history-list">
            {userHistory.slice(-5).map((item, index) => (
              <div key={index} className="history-item">{item}</div>
            ))}
          </div>
        </div>
      </div>
      
      {showCreateModal && (
        <ModalCreateGift 
          onSubmit={createGift} 
          onClose={() => setShowCreateModal(false)} 
          creating={creatingGift} 
          giftData={newGiftData} 
          setGiftData={setNewGiftData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedGift && (
        <GiftDetailModal 
          gift={selectedGift} 
          onClose={() => setSelectedGift(null)} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptGift={() => decryptGift(selectedGift.id)}
          claimGift={claimGift}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
    </div>
  );
};

const ModalCreateGift: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  creating: boolean;
  giftData: any;
  setGiftData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, creating, giftData, setGiftData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      const intValue = value.replace(/[^\d]/g, '');
      setGiftData({ ...giftData, [name]: intValue });
    } else {
      setGiftData({ ...giftData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="create-gift-modal">
        <div className="modal-header">
          <h2>Add New Gift</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 Protection</strong>
            <p>Gift amount encrypted with Zama FHE for privacy</p>
          </div>
          
          <div className="form-group">
            <label>Gift Name *</label>
            <input 
              type="text" 
              name="name" 
              value={giftData.name} 
              onChange={handleChange} 
              placeholder="Enter gift name..." 
            />
          </div>
          
          <div className="form-group">
            <label>Description</label>
            <textarea 
              name="description" 
              value={giftData.description} 
              onChange={handleChange} 
              placeholder="Gift description..." 
            />
          </div>
          
          <div className="form-group">
            <label>Gift Amount (Integer only) *</label>
            <input 
              type="number" 
              name="amount" 
              value={giftData.amount} 
              onChange={handleChange} 
              placeholder="Enter amount..." 
              step="1"
              min="0"
            />
            <div className="data-type-label">FHE Encrypted Amount</div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">Cancel</button>
          <button 
            onClick={onSubmit} 
            disabled={creating || isEncrypting || !giftData.name || !giftData.amount} 
            className="submit-btn"
          >
            {creating || isEncrypting ? "Encrypting..." : "Create Gift"}
          </button>
        </div>
      </div>
    </div>
  );
};

const GiftDetailModal: React.FC<{
  gift: GiftItem;
  onClose: () => void;
  isDecrypting: boolean;
  decryptGift: () => Promise<number | null>;
  claimGift: (giftId: string) => void;
}> = ({ gift, onClose, isDecrypting, decryptGift, claimGift }) => {
  const handleDecrypt = async () => {
    await decryptGift();
  };

  return (
    <div className="modal-overlay">
      <div className="gift-detail-modal">
        <div className="modal-header">
          <h2>Gift Details</h2>
          <button onClick={onClose} className="close-modal">×</button>
        </div>
        
        <div className="modal-body">
          <div className="gift-info">
            <div className="info-item">
              <span>Gift Name:</span>
              <strong>{gift.name}</strong>
            </div>
            <div className="info-item">
              <span>Description:</span>
              <strong>{gift.description}</strong>
            </div>
            <div className="info-item">
              <span>Status:</span>
              <strong className={gift.publicValue2 > 0 ? 'claimed' : 'available'}>
                {gift.publicValue2 > 0 ? 'Claimed' : 'Available'}
              </strong>
            </div>
            <div className="info-item">
              <span>Created:</span>
              <strong>{new Date(gift.timestamp * 1000).toLocaleDateString()}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>Encrypted Amount</h3>
            
            <div className="data-row">
              <div className="data-label">Gift Value:</div>
              <div className="data-value">
                {gift.isVerified ? 
                  `$${gift.decryptedValue} (Decrypted)` : 
                  "🔒 FHE Encrypted"
                }
              </div>
              <button 
                className={`decrypt-btn ${gift.isVerified ? 'decrypted' : ''}`}
                onClick={handleDecrypt} 
                disabled={isDecrypting || gift.isVerified}
              >
                {isDecrypting ? "Decrypting..." : gift.isVerified ? "✅ Decrypted" : "🔓 Decrypt"}
              </button>
            </div>
            
            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE Privacy Protection</strong>
                <p>Amount encrypted to prevent public comparison while allowing verification</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">Close</button>
          {gift.publicValue2 === 0 && (
            <button 
              onClick={() => claimGift(gift.id)} 
              className="claim-btn"
            >
              Claim This Gift
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;


