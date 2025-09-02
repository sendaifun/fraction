use crate::{errors::*, states::*};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
#[instruction(name: String)]
pub struct WithdrawShare<'info> {
    pub participant: Signer<'info>,

    /// CHECK: The authority used to create the PDA. Checked via constraints.
    pub authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"fraction_config", authority.key().as_ref(), name.as_ref()],
        bump,
        constraint = fraction_config.authority == authority.key() @ FractionError::InvalidAuthority,
        constraint = fraction_config.name == name @ FractionError::NameMismatch
    )]
    pub fraction_config: Box<Account<'info, FractionConfig>>,

    #[account(mut, seeds = [b"balance", fraction_config.key().as_ref(), participant.key().as_ref()], bump = participant_balance.bump)]
    pub participant_balance: Box<Account<'info, ParticipantBalance>>,

    #[account(mut, associated_token::mint = treasury_mint, associated_token::authority = fraction_config, associated_token::token_program = token_program)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    pub treasury_mint: InterfaceAccount<'info, Mint>,
    #[account(mut, constraint = participant_token_account.mint == treasury_mint.key())]
    pub participant_token_account: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> WithdrawShare<'info> {
    pub fn withdraw_share(&mut self) -> Result<()> {
        require!(
            self.participant_balance.amount > 0,
            FractionError::InsufficientBalance
        );
        require!(
            self.participant.key() == self.participant_balance.participant,
            FractionError::UnauthorizedWithdrawal
        );

        let withdraw_amount = self.participant_balance.amount;
        self.participant_balance.amount = 0;

        let signer_seeds = &[
            b"fraction_config",
            self.fraction_config.authority.as_ref(),
            self.fraction_config.name.as_ref(),
            &[self.fraction_config.bump],
        ];
        let signer = &[&signer_seeds[..]];

        transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                TransferChecked {
                    from: self.treasury.to_account_info(),
                    mint: self.treasury_mint.to_account_info(),
                    to: self.participant_token_account.to_account_info(),
                    authority: self.fraction_config.to_account_info(),
                },
                signer,
            ),
            withdraw_amount,
            self.treasury_mint.decimals,
        )?;
        Ok(())
    }
}
