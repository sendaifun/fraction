use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked},
};
use crate::states::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct DepositTokens<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(
        mut,
        seeds = [b"splitter_config", splitter_config.authority.as_ref()],
        bump,
    )]
    pub splitter_config: Account<'info, SplitterConfig>,

    #[account(
        mut,
        associated_token::mint = treasury_mint,
        associated_token::authority = splitter_config,
        associated_token::token_program = token_program,
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    #[account(
        constraint = treasury_mint.key() == splitter_config.treasury_mint
    )]
    pub treasury_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        constraint = user_token_account.mint == treasury_mint.key()
    )]
    pub user_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> DepositTokens<'info> {
    pub fn deposit_tokens(&mut self, amount: u64) -> Result<()> {
        // Transfer tokens from user to treasury using transfer_checked
        let transfer_ctx = CpiContext::new(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.user_token_account.to_account_info(),
                mint: self.treasury_mint.to_account_info(),
                to: self.treasury.to_account_info(),
                authority: self.user.to_account_info(),
            },
        );

        transfer_checked(transfer_ctx, amount, self.treasury_mint.decimals)?;

        // Update total collected amount
        self.splitter_config.total_collected = self.splitter_config.total_collected.checked_add(amount)
            .ok_or(SplitsError::ArithmeticOverflow)?;
        Ok(())
    }
}
