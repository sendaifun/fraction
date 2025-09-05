#![allow(unexpected_cfgs)]
#![warn(deprecated)]
use anchor_lang::prelude::*;

pub mod instructions;
pub mod states;
pub use instructions::*;
pub use states::*;
pub mod errors;
pub use errors::*;

declare_id!("2TZRnTed4ABnL41fLhcPn77d8AdqntYiEoKcvRtPeAK8");

#[program]
pub mod fraction {
    use super::*;

    #[instruction(discriminator = 1)]
    pub fn initialize_fraction(
        ctx: Context<InitializeFraction>,
        name: String,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
    ) -> Result<()> {
        ctx.accounts.initialize_fraction(
            name,
            participants,
            bot_wallet,
            &ctx.bumps,
        )
    }

    #[instruction(discriminator = 2)]
    pub fn update_fraction(
        ctx: Context<UpdateFraction>,
        _name: String,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
    ) -> Result<()> {
        ctx.accounts.update_fraction(participants, bot_wallet)
    }

    #[instruction(discriminator = 3)]
    pub fn claim_and_distribute(ctx: Context<ClaimAndDistribute>, _name: String) -> Result<()> {
        ctx.accounts.claim_and_distribute()
    }
}
