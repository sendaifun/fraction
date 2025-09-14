# Technical Documentation

## Protocol Specification

The Fraction protocol implements atomic revenue distribution on Solana, enabling automated fund splits among multiple participants through agent-executed transactions.

## System Architecture

### Protocol Flow

```
Configuration → Treasury Funding → Agent Execution → Distribution Settlement
```

**Configuration Phase**: Admin establishes participant allocation and agent authorization
**Treasury Funding**: Client deposits funds to shared treasury account  
**Agent Execution**: Authorized agent triggers atomic distribution
**Distribution Settlement**: Participants receive allocated shares instantly

## Configuration Phase

### Initialize Protocol

**Operation**: `initialize_fraction`
**Authorization**: Admin wallet only

Creates the core configuration account storing participant allocation rules and agent authorization.

**Account Structure**:
```rust
FractionConfig {
    authority: Pubkey,               // Admin wallet
    name: String,                    // Configuration identifier  
    participants: [Participant; 5], // Revenue split allocation
    bot_wallet: Pubkey,             // Authorized agent wallet
    incentive_bps: u8,              // Fixed at 200 (2%)
    bump: u8                        // PDA bump seed
}
```

**Validation Rules**:
- Participant shares must total exactly 10,000 basis points (100%)
- Maximum 5 participants per configuration
- Agent wallet must be unique from all participants

### Update Configuration

**Operation**: `update_fraction`
**Authorization**: Admin wallet only

Modifies participant allocation percentages and agent wallet authorization while preserving protocol integrity.

**Update Constraints**:
- Total allocation must remain 100% (10,000 BPS)
- Agent authorization can be transferred
- Protocol fee remains fixed at 2%

## Treasury Management

### Treasury Account Creation

**Implementation**: Client-side operation using SPL Token standard
**Authority**: Configuration PDA owns treasury account

The treasury operates as an Associated Token Account (ATA) owned by the protocol configuration, ensuring secure fund custody while enabling agent-triggered distribution.

**Implementation**:
```typescript
const treasury = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    tokenMint,
    fractionConfigPda,
    true // Allow PDA authority
);
```

### Treasury Funding

**Operation**: Standard SPL token transfer to treasury account
**Authorization**: Any wallet can fund the treasury

Clients deposit funds to the treasury account, making them available for distribution. The protocol configuration remains unchanged during funding operations.

**Funding Flow**:
```
Client Wallet → Treasury Account → Ready for Distribution
```

**State Changes**:
- Treasury balance increases by deposit amount
- Protocol configuration remains unchanged
- Distribution becomes available for agent execution

## Distribution Execution

### Agent-Triggered Distribution

**Operation**: `claim_and_distribute`
**Authorization**: Authorized agent wallet only

The distribution mechanism executes atomic transfers to all participants in a single transaction, ensuring complete fund allocation with no manual intervention required.

**Execution Prerequisites**:
- Treasury balance greater than zero
- Agent wallet signature verification
- All participant token accounts must exist
- Treasury account validation

### Distribution Calculation

**Protocol Fee**: 2% of total treasury balance allocated to agent
**Participant Pool**: 98% of total treasury balance split according to configuration

**Mathematical Implementation**:
```rust
let treasury_balance = treasury.amount;
let agent_fee = treasury_balance * 200 / 10_000;        // 2%
let participant_pool = treasury_balance - agent_fee;    // 98%

for participant in participants {
    let allocation = participant_pool * participant.share_bps / 10_000;
    transfer_checked(treasury, participant_ata, allocation);
}
```

### Atomic Settlement

**Transaction Structure**: All transfers execute within single transaction boundary
**Settlement Guarantee**: Either all transfers succeed or entire transaction reverts

**Post-Distribution State**:
- Treasury balance reduced to zero
- Agent receives protocol fee immediately
- Participants receive allocated shares directly
- No additional withdrawal operations required

**Distribution Flow**:
```
Treasury Balance → Agent Fee (2%) + Participant Allocations (98%) → Empty Treasury
```

## Recurring Distribution Cycles

### Multi-Round Operations

The protocol supports continuous operation through repeated funding and distribution cycles without requiring configuration changes.

**Cycle Pattern**:
```
Treasury Funding → Agent Distribution → Empty Treasury → Repeat
```

**Operation Characteristics**:
- Configuration remains persistent across cycles
- Agent authorization maintained between rounds
- Participant allocations preserved unless updated
- Treasury can be refunded immediately after distribution

### Implementation Example

**Scenario**: Automated Revenue Distribution System

**Initial Configuration**:
- 5 team members with defined revenue splits
- Automated agent for distribution execution
- USDC as distribution token

**Operational Flow**:
```
Week 1: Deploy configuration with participant allocations
Week 2: Client deposits 10,000 USDC to treasury
Week 3: Agent executes distribution (200 USDC fee + 9,800 USDC to participants)
Week 4: Treasury refunded with 15,000 USDC for next cycle
```

**Distribution Results**:
- Agent: 200 USDC protocol fee
- Participants: Receive allocated percentages of 9,800 USDC
- Treasury: Emptied and ready for next funding cycle
- No manual intervention required from participants

## Security Architecture

### Access Control Matrix

**Configuration Operations**: Admin wallet authorization required
**Treasury Management**: Open to any wallet for funding
**Distribution Execution**: Authorized agent wallet only

### Validation Framework

**Account Validation**: Program verifies account ownership and derivation
**Signature Verification**: Required signatures enforced at transaction level  
**Mathematical Validation**: Overflow protection and precision checks
**Constraint Enforcement**: Anchor framework handles access control automatically

**Critical Validations**:
- Participant allocations must total 100% (10,000 BPS)
- Agent wallet cannot be participant wallet
- Treasury must be owned by configuration PDA
- All participant token accounts must exist before distribution

### Error Handling

**Validation Failures**: Early return with descriptive error messages
**Constraint Violations**: Automatic rejection by Anchor framework
**Mathematical Errors**: Checked arithmetic operations prevent overflow
**Account Errors**: Verification of account existence and proper ownership

## Protocol Design Principles

**Atomic Operations**: Each instruction succeeds completely or fails entirely
**State Consistency**: All related accounts updated in single transaction
**Access Segregation**: Clear authorization boundaries for different operations
**Mathematical Precision**: Basis points system ensures accurate percentage calculations
**Security Priority**: All operations validated before execution
**Immediate Settlement**: Participants receive funds instantly upon distribution
**Simplified User Experience**: No manual withdrawal operations required

The protocol architecture ensures secure, efficient, and user-friendly fund distribution while maintaining complete integrity of participant management and treasury operations. The direct distribution model eliminates operational complexity and provides immediate settlement for all parties.
