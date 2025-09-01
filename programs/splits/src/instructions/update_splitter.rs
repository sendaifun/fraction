use crate::{errors::*, states::*};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(name: String, participants: [Participant; 5], bot_wallet: Pubkey)]
pub struct UpdateSplitter<'info> {
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"splitter_config", authority.key().as_ref(), name.as_ref()],
        bump,
        has_one = authority,
        constraint = splitter_config.name == name @ SplitsError::NameMismatch
    )]
    pub splitter_config: Account<'info, SplitterConfig>,
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

        self.splitter_config.participants = participants;
        self.splitter_config.bot_wallet = bot_wallet;
        Ok(())
    }
}
