use crate::{errors::*, states::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(name: String, participants: [Participant; 5], bot_wallet: Pubkey)]
pub struct UpdateSplitter<'info> {
    pub authority: Signer<'info>, 

    #[account(
        mut,
        seeds = [b"splitter_config", authority.key().as_ref(), splitter_config.name.as_ref()],
        bump = splitter_config.bump,   
        constraint = splitter_config.authority == authority.key() @ SplitsError::InvalidAuthority,
        constraint = splitter_config.bot_wallet == bot_wallet @ SplitsError::InvalidBot,
        constraint = splitter_config.name == name @ SplitsError::NameMismatch
    )]
    pub splitter_config: Box<Account<'info, SplitterConfig>>,
}

impl<'info> UpdateSplitter<'info> {
    pub fn update_splitter(
        &mut self,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
    ) -> Result<()> {
        let total_shares: u32 = participants.iter().map(|p| p.share_bps as u32).sum();
        require!(
            total_shares == 10_000,
            SplitsError::InvalidShareDistribution
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
                    SplitsError::DuplicateParticipantWallet
                );
            }
        }

        // Check for bot wallet conflict with participants
        require!(
            !wallets.contains(&bot_wallet),
            SplitsError::BotWalletConflict
        );

        self.splitter_config.participants = participants;
        self.splitter_config.bot_wallet = bot_wallet;
        Ok(())
    }
}
