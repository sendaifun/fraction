#![allow(unexpected_cfgs)]
#![warn(deprecated)]
use anchor_lang::prelude::*;

pub mod instructions;
pub mod states;
pub use instructions::*;
pub use states::*;
pub mod errors;
pub use errors::*;

declare_id!("FracVQuBhSeBvbw1qNrJKkDmcdPcFYWdneoKbJa3HMrj");

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
        participants: [Participant; 5],
        bot_wallet: Pubkey,
    ) -> Result<()> {
        ctx.accounts.update_fraction(participants, bot_wallet)
    }

    #[instruction(discriminator = 3)]
    pub fn claim_and_distribute(ctx: Context<ClaimAndDistribute>) -> Result<()> {
        ctx.accounts.claim_and_distribute()
    }
}


#[cfg(not(feature = "no-entrypoint"))]
use solana_security_txt::security_txt;
#[cfg(not(feature = "no-entrypoint"))]
security_txt! {
    name: "Fraction",
    project_url: "https://fraction.sendai.fun",
    contacts: "link:https://github.com/sendaifun/fraction/blob/main/SECURITY.md",
    policy: "https://github.com/sendaifun/fraction/blob/main/SECURITY.md",
    preferred_languages: "en",
    source_code: "https://github.com/sendaifun/fraction"
}