use std::char::MAX;

use crate::{errors::*, states::*};
use anchor_lang::prelude::*;
use crate::instructions::MAX_PARTICIPANTS;

#[derive(Accounts)]
pub struct UpdateFraction<'info> {
    pub authority: Signer<'info>, 

    #[account(
        mut,
        seeds = [b"fraction_config", fraction_config.authority.key().as_ref(), fraction_config.name.as_ref()],
        bump = fraction_config.config_bump,   
        has_one = authority,
    )]
    pub fraction_config: Box<Account<'info, FractionConfig>>,
}

impl<'info> UpdateFraction<'info> {
    pub fn update_fraction(
        &mut self,
        participants: [Participant; MAX_PARTICIPANTS],
        bot_wallet: Pubkey,
    ) -> Result<()> {
        let total_shares: u32 = participants.iter().map(|p| p.share_bps as u32).sum();
        require!(
            total_shares == 10_000,
            FractionError::InvalidShareDistribution
        );

        for p in participants.iter() {
            if p.wallet == anchor_lang::system_program::ID && p.share_bps > 0 {
                return Err(FractionError::SystemProgramParticipant.into());
            }
        }

        // Check for duplicate participant wallets
        let wallets: [Pubkey; MAX_PARTICIPANTS] = std::array::from_fn(|i| participants[i].wallet);
        for i in 0..MAX_PARTICIPANTS {
            for j in (i + 1)..MAX_PARTICIPANTS {
                if wallets[i] == anchor_lang::system_program::ID || wallets[j] == anchor_lang::system_program::ID {
                    continue;
                }
                require!(
                    wallets[i] != wallets[j],
                    FractionError::DuplicateParticipantWallet
                );
            }
        }

        // Check for bot wallet conflict with participants
        require!(
            !wallets.contains(&bot_wallet),
            FractionError::BotWalletConflict
        );

        self.fraction_config.participants = participants;
        self.fraction_config.bot_wallet = bot_wallet;
        Ok(())
    }
}
