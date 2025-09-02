#![allow(unexpected_cfgs)]
#![warn(deprecated)]
use anchor_lang::prelude::*;

pub mod instructions;
pub mod states;
pub use instructions::*;
pub use states::*;
pub mod errors;
pub use errors::*;

declare_id!("FM9hKTFN98M2uo7zw2huAbx7vJTQpfgFuxr9rVCTt8UY");

#[program]
pub mod fraction {
    use super::*;

    pub fn initialize_fraction(
        ctx: Context<InitializeFraction>,
        name: String,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
        participant_wallet_0: Pubkey,
        participant_wallet_1: Pubkey,
        participant_wallet_2: Pubkey,
        participant_wallet_3: Pubkey,
        participant_wallet_4: Pubkey,
    ) -> Result<()> {
        ctx.accounts.initialize_fraction(
            name,
            participants,
            bot_wallet,
            participant_wallet_0,
            participant_wallet_1,
            participant_wallet_2,
            participant_wallet_3,
            participant_wallet_4,
            &ctx.bumps,
        )
    }

    pub fn update_fraction(
        ctx: Context<UpdateFraction>,
        _name: String,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
    ) -> Result<()> {
        ctx.accounts.update_fraction(participants, bot_wallet)
    }

    pub fn claim_and_distribute(ctx: Context<ClaimAndDistribute>, _name: String) -> Result<()> {
        ctx.accounts.claim_and_distribute()
    }

    pub fn withdraw_share(ctx: Context<WithdrawShare>, _name: String) -> Result<()> {
        ctx.accounts.withdraw_share()
    }
}
