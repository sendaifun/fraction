use anchor_lang::prelude::*;
use crate::states::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct UpdateSplitter<'info> {
    pub authority: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"splitter_config", authority.key().as_ref()],
        bump,
        has_one = authority
    )]
    pub splitter_config: Account<'info, SplitterConfig>,
}

impl<'info> UpdateSplitter<'info> {
    pub fn update_splitter(
        &mut self,
        participants: [Participant; 5],
        bot_wallet: Pubkey,
    ) -> Result<()> {
        // Validate that participant shares sum to 10,000 (100%)
        let total_shares: u32 = participants.iter().map(|p| p.share_bps as u32).sum();
        require!(total_shares == 10_000, SplitsError::InvalidShareDistribution);

        let splitter_config = &mut self.splitter_config;
        splitter_config.participants = participants;
        splitter_config.bot_wallet = bot_wallet;
        Ok(())
    }
}
