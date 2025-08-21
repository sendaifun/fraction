use anchor_lang::prelude::*;
use anchor_spl::{
    token_interface::{Mint, TokenAccount, TokenInterface, TransferChecked, transfer_checked},
};
use crate::states::*;
use crate::errors::*;

#[derive(Accounts)]
pub struct WithdrawShare<'info> {
    pub participant: Signer<'info>,
    
    #[account(
        seeds = [b"splitter_config", splitter_config.authority.as_ref()],
        bump,
    )]
    pub splitter_config: Account<'info, SplitterConfig>,

    #[account(
        constraint = authority.key() == splitter_config.authority
    )]
    pub authority: Signer<'info>,

    #[account(
        mut,
        seeds = [b"balance", splitter_config.key().as_ref(), participant.key().as_ref()],
        bump,
        constraint = participant_balance.participant == participant.key()
    )]
    pub participant_balance: Account<'info, ParticipantBalance>,

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
        constraint = participant_token_account.mint == treasury_mint.key()
    )]
    pub participant_token_account: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> WithdrawShare<'info> {
    pub fn withdraw_share(&mut self) -> Result<()> {
        let participant_balance = &mut self.participant_balance;
        
        require!(participant_balance.amount > 0, SplitsError::InsufficientBalance);
        require!(self.participant.key() == participant_balance.participant, SplitsError::UnauthorizedWithdrawal);

        let withdraw_amount = participant_balance.amount;
        participant_balance.amount = 0;

        // Transfer tokens from treasury to participant using transfer_checked
        // Derive the correct bump for the splitter_config PDA
        let (_pda, bump) = Pubkey::find_program_address(
            &[b"splitter_config", self.splitter_config.authority.as_ref()],
            &crate::ID,
        );
        
        let signer_seeds = &[
            b"splitter_config",
            self.splitter_config.authority.as_ref(),
            &[bump],
        ];
        let signer = &[&signer_seeds[..]];

        let transfer_ctx = CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            TransferChecked {
                from: self.treasury.to_account_info(),
                mint: self.treasury_mint.to_account_info(),
                to: self.participant_token_account.to_account_info(),
                authority: self.splitter_config.to_account_info(),
            },
            signer,
        );

        transfer_checked(transfer_ctx, withdraw_amount, self.treasury_mint.decimals)?;
        Ok(())
    }
}
