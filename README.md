# Fraction

A secure, automated token distribution system built on Solana that splits funds among multiple participants with a fixed bot incentive.

## 🌟 Overview

Fraction is a Solana program that enables automated token distribution among multiple participants. Clients fund a shared treasury, and a designated bot triggers distribution where participants receive their allocated shares and the bot earns a fixed 2% incentive for managing the distribution.

## ✨ Key Features

- **🔐 Secure Distribution**: Built with Anchor framework for maximum security
- **🤖 Bot-Only Distribution**: Only designated bot wallet can trigger distributions
- **📊 Flexible Shares**: Customizable participant share percentages (up to 5 participants)
- **🎯 Fixed Bot Incentive**: Consistent 2% reward for distribution management
- **🏦 Client-Managed Treasury**: Treasury creation and funding handled client-side
- **💰 Immediate Bot Rewards**: Bot receives incentive tokens instantly upon distribution
- **💸 Individual Withdrawals**: Participants can withdraw their allocated funds independently
- **🔄 Multiple Rounds**: Treasury can be refunded for multiple distribution rounds

## 🏗️ Architecture

### Core Components

1. **Splitter Config**: Main configuration PDA storing participant details and bot wallet
2. **Treasury**: Associated Token Account (client-managed) holding funds for distribution
3. **Participant Balances**: Individual PDAs tracking each participant's allocated amount  
4. **Bot Balance**: PDA tracking bot's earned incentives

### Distribution Flow

```
Client Creates Treasury → Client Funds Treasury → Bot Distributes (Bot: 2% immediate, Participants: 98% tracked) → Individual Withdrawals
```

## 🚀 Instructions

### 1. Initialize Splitter
Creates a new splitter with participant configuration (authority only).

```rust
initialize_splitter(
    name: String,
    participants: [Participant; 5],
    bot_wallet: Pubkey,
    // Individual participant wallets for PDA derivation
    participant_wallet_0: Pubkey,
    participant_wallet_1: Pubkey,
    participant_wallet_2: Pubkey,
    participant_wallet_3: Pubkey,
    participant_wallet_4: Pubkey,
)
```

### 2. Update Splitter
Modify participant shares and bot wallet (authority only).

```rust
update_splitter(
    participants: [Participant; 5],
    bot_wallet: Pubkey,
)
```

### 3. Treasury Management (Client-Side)
Create treasury and fund it with tokens for distribution.

```typescript
// Create treasury ATA (client-side)
const treasury = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, splitterConfigPda, true
);

// Fund treasury (client-side)  
await transfer(connection, payer, userTokenAccount, treasury.address, authority, amount);
```

### 4. Claim and Distribute
Trigger distribution of treasury funds (bot only).

```rust
claim_and_distribute()
```
- Only the designated bot wallet can call this instruction
- Bot receives 2% immediately, participants get balance records updated
- Treasury funds are preserved for participant withdrawals

### 5. Withdraw Share
Individual participants withdraw their allocated tokens.

```rust
withdraw_share()
```
- Each participant can withdraw their allocated amount from treasury
- Participant balance record is reset to 0 after withdrawal

## 📊 Account Structure

### SplitterConfig
```rust
pub struct SplitterConfig {
    pub authority: Pubkey,               // Admin wallet
    pub name: String,                    // Splitter identifier
    pub participants: [Participant; 5], // Fixed array of 5 participants
    pub bot_wallet: Pubkey,             // Bot wallet address
    pub total_collected: u64,           // Temporary storage during distribution
    pub incentive_bps: u8,              // Fixed at 200 (2%)
    pub bump: u8,                       // PDA bump seed
}
```

### Participant
```rust
pub struct Participant {
    pub wallet: Pubkey,    // Participant's wallet
    pub share_bps: u16,    // Share in basis points (10000 = 100%)
}
```

### ParticipantBalance
```rust
pub struct ParticipantBalance {
    pub splitter: Pubkey,     // Associated splitter
    pub participant: Pubkey,  // Participant wallet
    pub amount: u64,          // Allocated amount
    pub bump: u8,             // PDA bump seed
}
```

## 🔧 Development Setup

### Prerequisites
- Rust 1.70+
- Solana CLI 1.16+
- Anchor Framework 0.28+
- Node.js 18+
- Yarn

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd Fraction
```

2. **Install dependencies**
```bash
# Install Rust dependencies
cargo build

# Install Node.js dependencies
yarn install
```

3. **Build the program**
```bash
anchor build
```

4. **Run tests**
```bash
anchor test
```

## 🧪 Testing

The project includes a comprehensive test suite with 8 test cases covering:

- ✅ **Core Functionality** (4 tests): Initialize, update, distribute, withdraw
- ✅ **Treasury Management** (2 tests): Client-side treasury creation and funding
- ✅ **Security & Authorization** (1 test): Access control and validation
- ✅ **Complete Lifecycle** (1 test): End-to-end flow with all participants

**Test Results**: 8/8 passing (100% success rate)

Run tests with:
```bash
anchor test
```

All tests validate the complete lifecycle: initialization → treasury management → bot-triggered distribution → participant withdrawals.

## 🔄 Complete Workflow

### Step-by-Step Process

1. **Setup Phase** (Authority)
   - Authority initializes splitter with 5 participants and their share percentages
   - All participant shares must total exactly 10,000 BPS (100%)
   - Bot wallet is designated for distribution control

2. **Treasury Phase** (Client-Side)
   - Client creates Associated Token Account (ATA) for treasury
   - Treasury is owned by the splitter config PDA for security
   - Client transfers tokens to treasury for distribution

3. **Distribution Phase** (Bot-Only)
   - Only the designated bot wallet can trigger distribution
   - Bot receives 2% of treasury funds immediately
   - Remaining 98% is allocated to participant balance records
   - Treasury retains participant funds for individual withdrawals

4. **Withdrawal Phase** (Individual Participants)
   - Each participant can withdraw their allocated tokens anytime
   - Tokens are transferred from treasury to participant's token account
   - Participant's balance record is reset to 0 after withdrawal
   - Process continues until all participants have withdrawn

### Key Benefits
- **Security**: Bot-only distribution prevents unauthorized access
- **Flexibility**: Participants withdraw when convenient
- **Efficiency**: Single distribution updates all balances simultaneously
- **Transparency**: All allocations are tracked on-chain

## 📋 Usage Examples

### TypeScript/JavaScript Client

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Fraction } from "./target/types/fraction";
import { getOrCreateAssociatedTokenAccount, transfer } from "@solana/spl-token";

// Initialize program
const program = anchor.workspace.Fraction as Program<Fraction>;

// Create a new splitter (5 participants required)
const participants = [
  { wallet: participant1.publicKey, shareBps: 3000 }, // 30%
  { wallet: participant2.publicKey, shareBps: 2500 }, // 25% 
  { wallet: participant3.publicKey, shareBps: 2000 }, // 20%
  { wallet: participant4.publicKey, shareBps: 1500 }, // 15%
  { wallet: participant5.publicKey, shareBps: 1000 }, // 10%
];

await program.methods
  .initializeSplitter(
    "my-splitter",
    participants,
    botWallet.publicKey,
    participant1.publicKey,
    participant2.publicKey,
    participant3.publicKey,
    participant4.publicKey,
    participant5.publicKey,
  )
  .accountsPartial({
    authority: authority.publicKey,
    splitterConfig: splitterConfigPda,
    participantBalance0: participantBalance0Pda,
    participantBalance1: participantBalance1Pda,
    participantBalance2: participantBalance2Pda,
    participantBalance3: participantBalance3Pda,
    participantBalance4: participantBalance4Pda,
    botBalance: botBalancePda,
  })
  .signers([])
  .rpc();

// Create and fund treasury (client-side)
const treasury = await getOrCreateAssociatedTokenAccount(
  connection, payer, mintAddress, splitterConfigPda, true
);

await transfer(
  connection, payer, userTokenAccount, treasury.address, authority, 1000000
);

// Trigger distribution (bot only)
await program.methods
  .claimAndDistribute()
  .accountsPartial({
    bot: botWallet.publicKey,
    splitterConfig: splitterConfigPda,
    treasury: treasury.address,
    treasuryMint: mintAddress,
    botTokenAccount: botTokenAccount,
    participantBalance0: participantBalance0Pda,
    participantBalance1: participantBalance1Pda,
    participantBalance2: participantBalance2Pda,
    participantBalance3: participantBalance3Pda,
    participantBalance4: participantBalance4Pda,
    botBalance: botBalancePda,
  })
  .signers([botWallet])
  .rpc();

// Participant withdraws (individual call)
await program.methods
  .withdrawShare()
  .accountsPartial({
    authority: authority.publicKey,
    participant: participant1.publicKey,
    splitterConfig: splitterConfigPda,
    participantBalance: participantBalance0Pda,
    treasury: treasury.address,
    treasuryMint: mintAddress,
    participantTokenAccount: participant1TokenAccount,
  })
  .signers([participant1])
  .rpc();
```

## 🔒 Security Features

- **Access Control**: Authority-only updates, bot-only distributions
- **PDA Security**: Proper seed validation for all accounts
- **Token Safety**: Uses `transfer_checked` for all token operations
- **Mathematical Precision**: Basis points system for accurate percentage calculations
- **Account Validation**: Comprehensive constraint checking via Anchor

## 🎯 Use Cases

- **Revenue Sharing**: Distribute project earnings among team members
- **Staking Rewards**: Automated distribution of staking rewards
- **DAO Treasuries**: Manage and distribute DAO funds
- **Creator Royalties**: Split NFT or content royalties
- **Investment Pools**: Distribute returns to investors
- **Gaming Rewards**: Distribute tournament prizes or in-game earnings

## 🛠️ Configuration

### Environment Variables
```bash
# Anchor.toml
[programs.localnet]
Fraction = "YOUR_PROGRAM_ID"

[programs.devnet]
Fraction = "YOUR_PROGRAM_ID"

[programs.mainnet]
Fraction = "YOUR_PROGRAM_ID"
```

### Program Constants
- **Bot Incentive**: Fixed at 2% (200 BPS)
- **Participants**: Exactly 5 participants required
- **Basis Points**: 10,000 = 100%

## 📊 Economics

### Fee Structure
- **Bot Incentive**: 2% of total distributed amount
- **Participant Share**: 98% of total distributed amount (split according to configured percentages)
- **No Additional Fees**: Only standard Solana transaction fees apply

### Example Distribution
For 1,000,000 tokens distributed:
- **Bot receives**: 20,000 tokens (2%)
- **Participants split**: 980,000 tokens (98% according to their share percentages)

## 🚀 Deployment

### Local Development
```bash
# Start local validator
solana-test-validator

# Deploy to local
anchor deploy
```

### Devnet Deployment
```bash
# Set to devnet
solana config set --url devnet

# Deploy
anchor deploy --provider.cluster devnet
```

### Mainnet Deployment
```bash
# Set to mainnet
solana config set --url mainnet-beta

# Deploy (ensure thorough testing first!)
anchor deploy --provider.cluster mainnet-beta
```

## 📚 Documentation

- [Anchor Documentation](https://anchor-lang.com/) - Framework documentation
- [Solana Documentation](https://docs.solana.com/) - Platform documentation
- [SPL Token Documentation](https://spl.solana.com/token) - Token program documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## ⚠️ Disclaimer

This software is provided "as is" without warranty. Users should conduct thorough testing and auditing before using in production. The developers are not responsible for any loss of funds.

## 🙋‍♂️ Support

For questions, issues, or contributions:
- Open an issue on GitHub
- Join our Discord community
- Email: support@fraction.com

---

**Built with ❤️ for the Solana ecosystem**
