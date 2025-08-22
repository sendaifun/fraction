#![allow(unexpected_cfgs)]
#![warn(deprecated)]
use anchor_lang::prelude::*;

pub mod instructions;
pub mod states;
pub use instructions::*;
pub use states::*;
pub mod errors;
pub use errors::*;

// FIX: Removed `declare_program!`, as it's deprecated and not needed.
// The program ID for the current program is declared below.
declare_id!("BWjBnoh7LE3Cogedykt8QJL6rMV817DNr2M8X1YLXhwH");

#[program]
pub mod splits {
    use super::*;

    pub fn initialize_splitter(
        ctx: Context<InitializeSplitter>,
        name: String,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
        participant_wallet_0: Pubkey,
        participant_wallet_1: Pubkey,
        participant_wallet_2: Pubkey,
        participant_wallet_3: Pubkey,
        participant_wallet_4: Pubkey,
    ) -> Result<()> {
        ctx.accounts.initialize_splitter(
            name, 
            participants, 
            bot_wallet,
            participant_wallet_0,
            participant_wallet_1,
            participant_wallet_2,
            participant_wallet_3,
            participant_wallet_4,
        )
    }

    pub fn update_splitter(
        ctx: Context<UpdateSplitter>,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
    ) -> Result<()> {
        ctx.accounts.update_splitter(participants, bot_wallet)
    }

    pub fn claim_and_distribute(
        ctx: Context<ClaimAndDistribute>,
    ) -> Result<()> {
        ctx.accounts.claim_and_distribute()
    }

    pub fn withdraw_share(
        ctx: Context<WithdrawShare>,
    ) -> Result<()> {
        ctx.accounts.withdraw_share()
    }
}