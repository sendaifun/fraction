use crate::{errors::*, states::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(name: String, participants: [Participant; 5], bot_wallet: Pubkey)]
pub struct UpdateFraction<'info> {
    pub authority: Signer<'info>, 

    #[account(
        mut,
        seeds = [b"fraction_config", authority.key().as_ref(), fraction_config.name.as_ref()],
        bump = fraction_config.bump,   
        constraint = fraction_config.authority == authority.key() @ FractionError::InvalidAuthority,
        constraint = fraction_config.bot_wallet == bot_wallet @ FractionError::InvalidBot,
        constraint = fraction_config.name == name @ FractionError::NameMismatch
    )]
    pub fraction_config: Box<Account<'info, FractionConfig>>,
}

impl<'info> UpdateFraction<'info> {
    pub fn update_fraction(
        &mut self,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
    ) -> Result<()> {
        let total_shares: u32 = participants.iter().map(|p| p.share_bps as u32).sum();
        require!(
            total_shares == 10_000,
            FractionError::InvalidShareDistribution
        );

        // Check for duplicate participant wallets
        let wallets = [
            participants[0].wallet,
            participants[1].wallet,
            participants[2].wallet,
            participants[3].wallet,
            participants[4].wallet,
        ];
        for i in 0..5 {
            for j in (i + 1)..5 {
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
