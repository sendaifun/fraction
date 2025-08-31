# Fraction - Project Flow Documentation

## 🔄 Complete System Flow Overview

This document outlines the complete flow of the Fraction system, from initial setup to final fund distribution and withdrawal.

## 📋 Flow Summary

```
1. Setup Phase
   ├── Initialize Splitter
   ├── Configure Participants
   └── Set Bot Wallet

2. Treasury Phase (Client-Side)
   ├── Client Creates Treasury ATA
   ├── Client Funds Treasury
   └── Treasury Ready for Distribution

3. Distribution Phase (Bot-Only)
   ├── Bot Triggers Distribution
   ├── Bot Gets 2% Immediately
   ├── Participants Get Balance Records (98%)
   └── Treasury Holds Participant Funds

4. Withdrawal Phase
   ├── Participants Withdraw Shares
   ├── Reset Individual Balances
   └── Treasury Emptied Gradually
```

---

## 🚀 Phase 1: Setup Phase

### 1.1 Initialize Splitter

**Trigger**: Authority wallet calls `initialize_splitter`

**What Happens**:
1. **Create SplitterConfig Account**
   - Generate PDA using `[b"splitter_config", authority.key(), name.as_ref()]`
   - Store splitter configuration data
   - Set participant shares (must total 10,000 BPS)

2. **Create Participant Balance Accounts**
   - Generate 5 PDAs using `[b"balance", splitter_config.key(), participant_wallet]`
   - Initialize each with 0 balance
   - Link to respective participant wallets

3. **Create Bot Balance Account**
   - Generate PDA using `[b"bot_balance", splitter_config.key(), bot_wallet]`
   - Initialize with 0 balance
   - Track bot's earned incentives

**Note**: Treasury is NOT created during initialization - it's handled client-side

**Data Stored**:
```rust
SplitterConfig {
    authority: authority_pubkey,
    name: "my_splitter",
    participants: [
        { wallet: participant1, shareBps: 3000 }, // 30%
        { wallet: participant2, shareBps: 2500 }, // 25%
        { wallet: participant3, shareBps: 2000 }, // 20%
        { wallet: participant4, shareBps: 1500 }, // 15%
        { wallet: participant5, shareBps: 1000 }, // 10%
    ],
    botWallet: bot_wallet_pubkey,
    totalCollected: 0, // Temporary during distribution
    incentiveBps: 200, // Fixed at 2%
    bump: pda_bump
}
```

**Accounts Created**:
- `splitter_config` PDA (owner: program)
- `participant_balance_0` through `participant_balance_4` PDAs
- `bot_balance` PDA

**Treasury Created Later**: Client creates treasury ATA separately

### 1.2 Configure Participants (Optional)

**Trigger**: Authority calls `update_splitter`

**What Happens**:
1. **Validate Authority**: Ensure caller is the splitter authority
2. **Update Participant Shares**: Modify individual participant percentages
3. **Update Bot Wallet**: Change the bot wallet if needed
4. **Preserve Incentive**: Bot incentive remains fixed at 2%

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

## 🏦 Phase 2: Treasury Management (Client-Side)

### 2.1 Create Treasury Account

**Trigger**: Client calls `getOrCreateAssociatedTokenAccount`

**What Happens**:
1. **Create ATA**: Generate Associated Token Account for the treasury
2. **Set Authority**: Treasury is owned by splitter_config PDA
3. **Initialize Empty**: Treasury starts with 0 balance

**Client-Side Code**:
```typescript
const treasury = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mintAddress,
    splitterConfigPda,
    true // Allow PDA owner
);
```

### 2.2 Fund Treasury

**Trigger**: Client calls `transfer` function

**What Happens**:
1. **Transfer Tokens**: Move tokens from user to treasury using SPL transfer
2. **No State Update**: Splitter config remains unchanged
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
Splitter config: unchanged
```

---

## 🎯 Phase 3: Distribution Phase (Bot-Only)

### 3.1 Bot Triggers Distribution

**Trigger**: ONLY configured bot wallet calls `claim_and_distribute`

**Prerequisites**:
- Treasury balance > 0
- Caller must be the configured `bot_wallet`
- All participant balance accounts must exist
- Bot must sign the transaction

### 3.2 Calculate Distribution

**What Happens**:
1. **Read Treasury Balance**: Get current treasury token amount
2. **Calculate Bot Incentive**: 2% of treasury balance
3. **Calculate Participant Pool**: 98% of treasury balance
4. **Update Balance Records**: Store participant allocations in PDAs

**Mathematical Flow**:
```rust
let treasury_balance = treasury.amount;
let bot_amount = treasury_balance * 200 / 10000;        // 2%
let participant_pool = treasury_balance - bot_amount;   // 98%

// Update participant balance records
for participant in participants {
    let participant_amount = participant_pool * participant.shareBps / 10000;
    participant_balance.amount += participant_amount; // Cumulative
}
```

**Example Distribution**:
```rust
// Total collected: 1,000,000 tokens
// Bot incentive: 20,000 tokens (2%)
// Participant pool: 980,000 tokens (98%)

// Distribution:
// Participant 1 (30%): 294,000 tokens
// Participant 2 (25%): 245,000 tokens
// Participant 3 (20%): 196,000 tokens
// Participant 4 (15%): 147,000 tokens
// Participant 5 (10%): 98,000 tokens
```

### 3.3 Execute Distribution

**What Happens**:
1. **Transfer Bot Incentive**: Move 2% immediately to bot's token account
2. **Update Participant Balances**: Store allocated amounts in PDAs
3. **Reset Total Collected**: Set `total_collected = 0` 
4. **Update Bot Balance PDA**: Track bot's earned amount
5. **Treasury Retains Funds**: 98% stays in treasury for withdrawals

**Transfer Flow**:
```
Treasury (2%) → Bot Token Account (immediate)
Treasury (98%) → Stays in Treasury (for withdrawals)
                ↓
        Participant Balance PDAs (records updated)
```

**State After Distribution**:
```rust
// SplitterConfig
total_collected: 0  // Reset

// Bot Balance PDA
amount: 20000       // Bot's earned incentive

// Bot Token Account
balance: +20000     // Bot received tokens immediately

// Participant Balance PDAs
participant_0: 294000  // 30% of 980,000
participant_1: 245000  // 25% of 980,000
participant_2: 196000  // 20% of 980,000
participant_3: 147000  // 15% of 980,000
participant_4: 98000   // 10% of 980,000

// Treasury
balance: 980000  // Participant funds ready for withdrawal
```

---

## 💸 Phase 4: Withdrawal Phase

### 4.1 Individual Participant Withdrawals

**Trigger**: Individual participant calls `withdraw_share`

**Prerequisites**:
- Participant must have allocated balance > 0
- Both participant and authority must sign
- Participant must provide correct balance PDA

**What Happens**:
1. **Validate Withdrawal**: Ensure participant has allocated funds > 0
2. **Transfer Tokens**: Move tokens from treasury to participant's token account
3. **Reset Balance**: Set participant balance PDA to 0  
4. **Update Treasury**: Decrease treasury balance

**Withdrawal Flow**:
```
Participant Balance PDA (check amount) → Treasury → Participant Token Account
                    ↓
              Reset PDA to 0
```

**Example Withdrawal**:
```rust
// Participant 1 withdraws their 294,000 tokens
withdraw_share()

// Result:
// - Participant 1 balance PDA: 0
// - Participant 1 token account: +294,000
// - Treasury balance: -294,000
```

### 4.2 Multiple Withdrawals

**What Happens**:
1. **Independent Withdrawals**: Each participant can withdraw independently
2. **No Interference**: One participant's withdrawal doesn't affect others
3. **Flexible Timing**: Withdrawals can happen at any time after distribution

**Withdrawal Timeline Example**:
```
Day 1: Participant 1 withdraws 294,000
Day 3: Participant 3 withdraws 196,000
Day 7: Participant 5 withdraws 98,000
Day 10: Participant 2 withdraws 245,000
Day 14: Participant 4 withdraws 147,000
```

---

## 🔄 Complete Lifecycle Example

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
1. Authority initializes splitter
2. Creates all necessary accounts
3. Sets initial 20% shares for each member
```

**Phase 2: Treasury Management**
```
Week 1: Client creates treasury ATA
Week 2: Client transfers 3000 USDC to treasury
Treasury Balance: 3000 USDC ready for distribution
```

**Phase 3: Distribution**
```
Bot triggers distribution:
- Bot receives: 60 USDC (2%) immediately
- Team records: 2940 USDC (98%) allocated

Allocation Records:
- Member 1: 882 USDC (30%)
- Member 2: 735 USDC (25%)
- Member 3: 588 USDC (20%)
- Member 4: 441 USDC (15%)
- Member 5: 294 USDC (10%)
```

**Phase 4: Withdrawals**
```
Day 1: Member 1 withdraws 882 USDC
Day 2: Member 3 withdraws 588 USDC
Day 3: Member 5 withdraws 294 USDC
Day 4: Member 2 withdraws 735 USDC
Day 5: Member 4 withdraws 441 USDC
```

**Final State**:
```
- All participants received their allocated shares
- Bot earned 60 USDC incentive immediately
- Treasury empty (ready for next cycle)
- All balance PDAs reset to 0
```

---

## 🔒 Security Flow

### Access Control
```
Initialize: Authority only
Update: Authority only  
Treasury Management: Client-side (anyone)
Distribute: Bot wallet only (with bot signature)
Withdraw: Participant + Authority signatures
```

### Validation Flow
```
1. Account Ownership: Verify all accounts belong to correct entities
2. PDA Seeds: Validate all PDA derivations
3. Signatures: Ensure proper signing requirements
4. Constraints: Check Anchor constraints (has_one, seeds, etc.)
5. Mathematical: Verify calculations and overflow protection
```

### Error Handling Flow
```
1. Validation Errors: Return early with descriptive messages
2. Constraint Violations: Anchor handles automatically
3. Mathematical Errors: Use checked operations
4. Account Errors: Verify account existence and ownership
```

---

## 📊 Data Flow Summary

### Input → Processing → Output

**Initialize**:
```
Input: Authority + Participants + Bot wallet
Processing: Create PDAs + Set initial state
Output: Complete splitter configuration
```

**Treasury Management**:
```
Input: Client + Mint + Amount
Processing: Create ATA + Transfer tokens
Output: Funded treasury ready for distribution
```

**Distribute**:
```
Input: Bot wallet signature + All accounts
Processing: Calculate + Transfer bot share + Update records
Output: Bot gets 2%, participants get balance records
```

**Withdraw**:
```
Input: Participant + Authority signatures
Processing: Transfer from treasury + Reset balance
Output: Participant tokens + Balance reset
```

---

## 🎯 Key Flow Principles

1. **Atomic Operations**: Each instruction completes fully or fails completely
2. **State Consistency**: All related accounts updated together
3. **Access Control**: Clear separation of who can perform what actions
4. **Mathematical Precision**: Basis points system ensures accurate calculations
5. **Security First**: All operations validated before execution
6. **Flexible Timing**: Users control when to deposit and withdraw
7. **Automated Distribution**: Bot handles complex distribution logic
8. **Independent Withdrawals**: Participants can withdraw at their convenience

This flow design ensures the system is secure, efficient, and user-friendly while maintaining the integrity of fund distribution and participant management.
