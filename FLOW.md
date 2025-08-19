# SolSplits - Project Flow Documentation

## 🔄 Complete System Flow Overview

This document outlines the complete flow of the SolSplits system, from initial setup to final fund distribution and withdrawal.

## 📋 Flow Summary

```
1. Setup Phase
   ├── Initialize Splitter
   ├── Configure Participants
   └── Set Bot Wallet

2. Deposit Phase
   ├── Users Deposit Tokens
   ├── Treasury Accumulation
   └── Track Total Collected

3. Distribution Phase
   ├── Bot Triggers Distribution
   ├── Calculate Bot Incentive (2%)
   ├── Distribute to Participants (98%)
   └── Reset Total Collected

4. Withdrawal Phase
   ├── Participants Withdraw Shares
   ├── Reset Individual Balances
   └── Update Treasury Balance
```

---

## 🚀 Phase 1: Setup Phase

### 1.1 Initialize Splitter

**Trigger**: Authority wallet calls `initialize_splitter`

**What Happens**:
1. **Create SplitterConfig Account**
   - Generate PDA using `[b"splitter_config", authority.key()]`
   - Store splitter configuration data
   - Set initial participant shares (default: 20% each)

2. **Create Treasury Account**
   - Generate ATA for the specified mint
   - Set splitter_config PDA as authority
   - Initialize with 0 balance

3. **Create Participant Balance Accounts**
   - Generate 5 PDAs using `[b"balance", splitter_config.key(), participant_wallet]`
   - Initialize each with 0 balance
   - Link to respective participant wallets

4. **Create Bot Balance Account**
   - Generate PDA using `[b"bot_balance", splitter_config.key()]`
   - Initialize with 0 balance
   - Track bot's earned incentives

**Data Stored**:
```rust
SplitterConfig {
    name: "my_splitter",
    authority: authority_pubkey,
    participants: [
        { wallet: participant1, shareBps: 2000 }, // 20%
        { wallet: participant2, shareBps: 2000 }, // 20%
        { wallet: participant3, shareBps: 2000 }, // 20%
        { wallet: participant4, shareBps: 2000 }, // 20%
        { wallet: participant5, shareBps: 2000 }, // 20%
    ],
    botWallet: bot_wallet_pubkey,
    treasuryMint: mint_pubkey,
    totalCollected: 0,
    incentiveBps: 200, // Fixed at 2%
    bump: pda_bump
}
```

**Accounts Created**:
- `splitter_config` PDA (owner: program)
- `treasury` ATA (owner: splitter_config PDA)
- `participant_balance_0` through `participant_balance_4` PDAs
- `bot_balance` PDA

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

## 💰 Phase 2: Deposit Phase

### 2.1 User Deposits Tokens

**Trigger**: Any user calls `deposit_tokens`

**What Happens**:
1. **Validate Accounts**: Ensure all accounts are correct
2. **Transfer Tokens**: Move tokens from user to treasury using `transfer_checked`
3. **Update State**: Increment `total_collected` in splitter config
4. **Verify Balance**: Confirm treasury balance increased

**Flow Diagram**:
```
User Token Account → transfer_checked → Treasury ATA
                                    ↓
                            Update total_collected
```

**Example Deposit**:
```rust
// User deposits 1,000,000 tokens (1 token with 6 decimals)
deposit_tokens(1000000)

// Result:
// - User balance: -1,000,000
// - Treasury balance: +1,000,000
// - total_collected: +1,000,000
```

### 2.2 Multiple Deposits

**What Happens**:
1. **Cumulative Tracking**: `total_collected` accumulates across multiple deposits
2. **No Distribution**: Funds remain in treasury until bot triggers distribution
3. **Flexible Timing**: Deposits can happen over time before distribution

**Example Timeline**:
```
Day 1: Deposit 500,000 → total_collected: 500,000
Day 3: Deposit 300,000 → total_collected: 800,000
Day 7: Deposit 200,000 → total_collected: 1,000,000
Day 10: Bot triggers distribution
```

---

## 🎯 Phase 3: Distribution Phase

### 3.1 Bot Triggers Distribution

**Trigger**: Configured bot wallet calls `claim_and_distribute`

**Prerequisites**:
- `total_collected > 0`
- Caller must be the configured `bot_wallet`
- All participant balance accounts must exist

### 3.2 Calculate Distribution

**What Happens**:
1. **Calculate Bot Incentive**: 2% of total collected
2. **Calculate Participant Pool**: 98% of total collected
3. **Distribute to Participants**: Based on their configured share percentages

**Mathematical Flow**:
```rust
let total = splitter_config.total_collected;
let bot_amount = total * 200 / 10000;        // 2%
let participant_pool = total - bot_amount;   // 98%

// Distribute to each participant
for participant in participants {
    let participant_amount = participant_pool * participant.shareBps / 10000;
    participant_balance.amount = participant_amount;
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

### 3.3 Execute Transfers

**What Happens**:
1. **Transfer Bot Incentive**: Move 2% to bot's token account
2. **Update Participant Balances**: Store allocated amounts in PDAs
3. **Reset Total Collected**: Set `total_collected = 0`
4. **Update Bot Balance PDA**: Store bot's earned amount

**Transfer Flow**:
```
Treasury → Bot Token Account (2%)
Treasury → Participant Balance PDAs (98% distributed)
```

**State After Distribution**:
```rust
// SplitterConfig
total_collected: 0  // Reset

// Bot Balance PDA
amount: 20000       // Bot's earned incentive

// Participant Balance PDAs
participant_0: 294000  // 30% of 980,000
participant_1: 245000  // 25% of 980,000
participant_2: 196000  // 20% of 980,000
participant_3: 147000  // 15% of 980,000
participant_4: 98000   // 10% of 980,000

// Treasury
balance: 0  // All funds distributed
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
1. **Validate Withdrawal**: Ensure participant has allocated funds
2. **Transfer Tokens**: Move tokens from treasury to participant's token account
3. **Reset Balance**: Set participant balance PDA to 0
4. **Update Treasury**: Decrease treasury balance

**Withdrawal Flow**:
```
Participant Balance PDA → Treasury → Participant Token Account
        ↓
    Reset to 0
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

**Phase 2: Revenue Collection**
```
Week 1: Deposit 1000 USDC
Week 2: Deposit 500 USDC
Week 3: Deposit 1500 USDC
Total Collected: 3000 USDC
```

**Phase 3: Distribution**
```
Bot triggers distribution:
- Bot receives: 60 USDC (2%)
- Team pool: 2940 USDC (98%)

Distribution:
- Member 1: 588 USDC (20%)
- Member 2: 588 USDC (20%)
- Member 3: 588 USDC (20%)
- Member 4: 588 USDC (20%)
- Member 5: 588 USDC (20%)
```

**Phase 4: Withdrawals**
```
Day 1: Member 1 withdraws 588 USDC
Day 2: Member 3 withdraws 588 USDC
Day 3: Member 5 withdraws 588 USDC
Day 4: Member 2 withdraws 588 USDC
Day 5: Member 4 withdraws 588 USDC
```

**Final State**:
```
- All participants received their shares
- Bot earned 60 USDC incentive
- Treasury empty (ready for next cycle)
- All balance PDAs reset to 0
```

---

## 🔒 Security Flow

### Access Control
```
Initialize: Authority only
Update: Authority only
Deposit: Anyone (with valid accounts)
Distribute: Bot wallet only
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
Input: Authority + Participants + Bot + Mint
Processing: Create PDAs + Set initial state
Output: Complete splitter configuration
```

**Deposit**:
```
Input: Amount + User accounts
Processing: Transfer + Update total_collected
Output: Treasury balance + Config update
```

**Distribute**:
```
Input: Bot wallet + All accounts
Processing: Calculate + Transfer + Update
Output: Distributed funds + Reset state
```

**Withdraw**:
```
Input: Participant + Authority signatures
Processing: Transfer + Reset balance
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
