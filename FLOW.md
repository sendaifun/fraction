# Fraction - Project Flow Documentation

## Complete System Flow Overview

This document outlines the complete flow of the Fraction system, from initial setup to final fund distribution and withdrawal.

## Flow Summary

```
1. Setup Phase
   ├── Initialize Fraction
   ├── Configure Participants
   └── Set Bot Wallet

2. Treasury Phase (Client-Side)
   ├── Client Creates Treasury ATA
   ├── Client Funds Treasury
   └── Treasury Ready for Distribution

3. Distribution Phase (Bot-Only)
   ├── Bot Triggers Direct Distribution
   ├── Bot Gets 2% Immediately
   ├── Participants Get 98% Directly in ATAs
   └── Treasury Emptied Completely

4. Ready for Next Round (Optional)
   ├── Client Refunds Treasury
   └── Repeat Distribution Process
```

---

## Phase 1: Setup Phase

### 1.1 Initialize Fraction

**Trigger**: Authority wallet calls `initialize_fraction`

**What Happens**:
1. **Create FractionConfig Account**
   - Generate PDA using `[b"fraction_config", authority.key(), name.as_ref()]`
   - Store fraction configuration data
   - Set participant shares (must total 10,000 BPS)

2. **Create Participant Token Accounts**
   - Ensure all participants have Associated Token Accounts for the treasury mint
   - These will receive tokens directly during distribution
   - No balance tracking PDAs needed in the new design

3. **Store Configuration**
   - Link fraction to participant wallets for direct distribution
   - No need to create participant balance PDAs

**Note**: Treasury is NOT created during initialization - it's handled client-side

**Data Stored**:
```rust
FractionConfig {
    authority: authority_pubkey,
    name: "my_fraction",
    participants: [
        { wallet: participant1, shareBps: 3000 }, // 30%
        { wallet: participant2, shareBps: 2500 }, // 25%
        { wallet: participant3, shareBps: 2000 }, // 20%
        { wallet: participant4, shareBps: 1500 }, // 15%
        { wallet: participant5, shareBps: 1000 }, // 10%
    ],
    botWallet: bot_wallet_pubkey,
    incentiveBps: 200, // Fixed at 2%
    bump: pda_bump
}
```

**Accounts Created**:
- `fraction_config` PDA (owner: program)

**Accounts Required Later**:
- Participant Associated Token Accounts (for direct distribution)
- Bot Associated Token Account (for incentive receipt)
- Treasury ATA (client creates separately)

### 1.2 Configure Participants (Optional)

**Trigger**: Authority calls `update_fraction`

**What Happens**:
1. **Validate Authority**: Ensure caller is the fraction authority
2. **Validate Shares**: Ensure participant shares sum to exactly 10,000 BPS (100%)
3. **Update Participant Shares**: Modify individual participant percentages
4. **Update Bot Wallet**: Change the bot wallet if needed
5. **Preserve Incentive**: Bot incentive remains fixed at 2%

**Example Update**:
```rust
// Before: Each participant has 20%
// After: Custom distribution
participants: [
    { wallet: participant1, shareBps: 3000 }, // 30%
    { wallet: participant2, shareBps: 2500 }, // 25%
    { wallet: participant3, shareBps: 2000 }, // 20%
    { wallet: participant4, shareBps: 1500 }, // 15%
    { wallet: participant5, shareBps: 1000 }, // 10%
]
// Total: 10000 BPS (100%)
```

---

## Phase 2: Treasury Management (Client-Side)

### 2.1 Create Treasury Account

**Trigger**: Client calls `getOrCreateAssociatedTokenAccount`

**What Happens**:
1. **Create ATA**: Generate Associated Token Account for the treasury
2. **Set Authority**: Treasury is owned by fraction_config PDA
3. **Initialize Empty**: Treasury starts with 0 balance
4. **Required Constraint**: Treasury must be an associated token account with proper mint and authority constraints

**Client-Side Code**:
```typescript
const treasury = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mintAddress,
    fractionConfigPda,
    true // Allow PDA owner
);
```

### 2.2 Fund Treasury

**Trigger**: Client calls `transfer` function

**What Happens**:
1. **Transfer Tokens**: Move tokens from user to treasury using SPL transfer
2. **No State Update**: Fraction config remains unchanged
3. **Ready for Distribution**: Treasury holds funds until bot distributes

**Client-Side Code**:
```typescript
await transfer(
    connection,
    payer,
    userTokenAccount,
    treasury.address,
    authority,
    1000000 // Amount to fund
);
```

**Example Funding**:
```
Before: Treasury balance = 0
After: Treasury balance = 1,000,000 tokens
Fraction config: unchanged
```

---

## Phase 3: Direct Distribution Phase (Bot-Only)

### 3.1 Bot Triggers Direct Distribution

**Trigger**: ONLY configured bot wallet calls `claim_and_distribute`

**Prerequisites**:
- Treasury balance > 0
- Caller must be the configured `bot_wallet`
- All participant token accounts must exist
- Bot must sign the transaction
- Treasury must be an associated token account owned by fraction config PDA

### 3.2 Calculate Distribution

**What Happens**:
1. **Read Treasury Balance**: Get current treasury token amount
2. **Calculate Bot Incentive**: 2% of treasury balance
3. **Calculate Participant Shares**: 98% of treasury balance distributed by participant percentages
4. **Execute Direct Transfers**: Transfer tokens directly to all participant ATAs

**Mathematical Flow**:
```rust
let treasury_balance = treasury.amount;
let bot_amount = treasury_balance * 200 / 10000;        // 2%
let participant_pool = treasury_balance - bot_amount;   // 98%

// Direct transfers to participant ATAs
for participant in participants {
    let participant_amount = participant_pool * participant.shareBps / 10000;
    // Transfer directly to participant's token account
    transfer_checked(treasury, participant_token_account, participant_amount);
}
```

**Example Distribution**:
```rust
// Total collected: 1,000,000 tokens
// Bot incentive: 20,000 tokens (2%)
// Participant pool: 980,000 tokens (98%)

// Direct Distribution:
// Participant 1 (30%): 294,000 tokens → P1's ATA
// Participant 2 (25%): 245,000 tokens → P2's ATA
// Participant 3 (20%): 196,000 tokens → P3's ATA
// Participant 4 (15%): 147,000 tokens → P4's ATA
// Participant 5 (10%): 98,000 tokens → P5's ATA
```

### 3.3 Execute Direct Distribution

**What Happens**:
1. **Transfer Bot Incentive**: Move 2% immediately to bot's token account
2. **Transfer Participant Shares**: Move tokens directly to each participant's ATA
3. **Empty Treasury**: All funds distributed, treasury balance becomes 0
4. **Atomic Operation**: All transfers happen in single transaction

**Transfer Flow**:
```
Treasury (2%) → Bot Token Account (immediate)
Treasury (98%) → Participant ATAs (immediate)
                ↓
        Treasury Balance = 0
```

**State After Distribution**:
```rust
// Bot Token Account
balance: +20000     // Bot received tokens immediately

// Participant Token Accounts
participant_0_ata: +294000  // 30% of 980,000
participant_1_ata: +245000  // 25% of 980,000
participant_2_ata: +196000  // 20% of 980,000
participant_3_ata: +147000  // 15% of 980,000
participant_4_ata: +98000   // 10% of 980,000

// Treasury
balance: 0  // Completely emptied
```

---

## Phase 4: Ready for Next Round (Optional)

### 4.1 Treasury Refunding

**Trigger**: Client can fund treasury again for additional rounds

**What Happens**:
1. **Refund Treasury**: Client transfers more tokens to treasury
2. **Ready for Distribution**: Treasury balance > 0, ready for next bot distribution
3. **Repeat Process**: Bot can trigger distribution again when ready

**Refund Flow**:
```
Client Token Account → Treasury → Ready for Next Distribution
```

**Example Multi-Round**:
```rust
// Round 1: Distribute 1,000,000 tokens
// Treasury: 0

// Round 2: Client funds 500,000 tokens
// Treasury: 500,000 → Bot distributes → Treasury: 0

// Round 3: Client funds 2,000,000 tokens  
// Treasury: 2,000,000 → Bot distributes → Treasury: 0
```

---

## Complete Lifecycle Example

### Scenario: Revenue Sharing for a Project

**Initial Setup**:
```
Project: "Web3 App"
Participants: 5 team members
Initial Shares: 20% each
Bot Wallet: Project manager
```

**Phase 1: Setup**
```
1. Authority initializes fraction
2. Creates all necessary accounts
3. Sets initial 20% shares for each member
```

**Phase 2: Treasury Management**
```
Week 1: Client creates treasury ATA
Week 2: Client transfers 3000 USDC to treasury
Treasury Balance: 3000 USDC ready for distribution
```

**Phase 3: Direct Distribution**
```
Bot triggers direct distribution:
- Bot receives: 60 USDC (2%) immediately in bot's ATA
- Team receives: 2940 USDC (98%) distributed directly to their ATAs

Direct Distribution:
- Member 1: 882 USDC → transferred to Member 1's ATA
- Member 2: 735 USDC → transferred to Member 2's ATA
- Member 3: 588 USDC → transferred to Member 3's ATA
- Member 4: 441 USDC → transferred to Member 4's ATA
- Member 5: 294 USDC → transferred to Member 5's ATA
```

**Final State**:
```
- All participants received their tokens directly in their ATAs
- Bot earned 60 USDC incentive immediately
- Treasury empty (ready for next cycle if needed)
- No withdrawal step required
```

---

## Security Flow

### Access Control
```
Initialize: Authority only
Update: Authority only (with share validation)
Treasury Management: Client-side (anyone)
Direct Distribution: Bot wallet only (with bot signature)
```

### Validation Flow
```
1. Account Ownership: Verify all accounts belong to correct entities
2. PDA Seeds: Validate PDA derivations for fraction config
3. Signatures: Ensure proper signing requirements
4. Constraints: Check Anchor constraints (has_one, seeds, etc.)
5. Mathematical: Verify calculations and overflow protection
6. Share Validation: Ensure participant shares sum to 10,000 BPS
7. Associated Token Accounts: Verify treasury and participant ATA constraints
```

### Error Handling Flow
```
1. Validation Errors: Return early with descriptive messages
2. Constraint Violations: Anchor handles automatically
3. Mathematical Errors: Use checked operations
4. Account Errors: Verify account existence and ownership
```

---

## Data Flow Summary

### Input → Processing → Output

**Initialize**:
```
Input: Authority + Participants + Bot wallet
Processing: Create PDAs + Set initial state
Output: Complete fraction configuration
```

**Treasury Management**:
```
Input: Client + Mint + Amount
Processing: Create ATA + Transfer tokens
Output: Funded treasury ready for distribution
```

**Direct Distribution**:
```
Input: Bot wallet signature + All accounts + Participant ATAs
Processing: Calculate + Transfer bot share + Transfer participant shares directly
Output: Bot gets 2%, participants get tokens directly in ATAs, treasury emptied
```

---

## Key Flow Principles

1. **Atomic Operations**: Each instruction completes fully or fails completely
2. **State Consistency**: All related accounts updated together
3. **Access Control**: Clear separation of who can perform what actions
4. **Mathematical Precision**: Basis points system ensures accurate calculations
5. **Security First**: All operations validated before execution
6. **Direct Distribution**: Bot transfers funds directly to participant ATAs in single transaction
7. **Simplified UX**: No manual withdrawal steps required for participants
8. **Immediate Settlement**: All parties receive tokens instantly during distribution

This flow design ensures the system is secure, efficient, and user-friendly while maintaining the integrity of fund distribution and participant management. The direct distribution model eliminates the complexity of separate withdrawal steps and provides immediate token settlement for all participants.
