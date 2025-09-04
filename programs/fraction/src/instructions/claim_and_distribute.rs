use crate::{errors::*, states::*};
use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};

#[derive(Accounts)]
#[instruction(name: String)]
pub struct ClaimAndDistribute<'info> {
    pub bot: Signer<'info>,

    /// CHECK: The authority used to create the PDA. Checked via constraints.
    pub authority: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [b"fraction_config", authority.key().as_ref(), name.as_ref()],
        bump,
        constraint = fraction_config.authority == authority.key() @ FractionError::InvalidAuthority,
        constraint = fraction_config.bot_wallet == bot.key() @ FractionError::InvalidBot,
        constraint = fraction_config.name == name @ FractionError::NameMismatch
    )]
    pub fraction_config: Box<Account<'info, FractionConfig>>,

    #[account(mut, associated_token::mint = treasury_mint, associated_token::authority = fraction_config, associated_token::token_program = token_program)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,
    pub treasury_mint: InterfaceAccount<'info, Mint>,

    #[account(mut, constraint = bot_token_account.mint == treasury_mint.key())]
    pub bot_token_account: Box<InterfaceAccount<'info, TokenAccount>>,

    #[account(mut, constraint = participant_token_account_0.mint == treasury_mint.key())]
    pub participant_token_account_0: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = participant_token_account_1.mint == treasury_mint.key())]
    pub participant_token_account_1: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = participant_token_account_2.mint == treasury_mint.key())]
    pub participant_token_account_2: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = participant_token_account_3.mint == treasury_mint.key())]
    pub participant_token_account_3: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, constraint = participant_token_account_4.mint == treasury_mint.key())]
    pub participant_token_account_4: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> ClaimAndDistribute<'info> {
    pub fn claim_and_distribute(&mut self) -> Result<()> {
        let treasury_balance = self.treasury.amount;
        require!(treasury_balance > 0, FractionError::NoFundsToDistribute);

        let bot_amount = treasury_balance
            .checked_mul(self.fraction_config.incentive_bps as u64)
            .and_then(|x| x.checked_div(10_000))
            .ok_or(FractionError::ArithmeticOverflow)?;

        let participant_total = treasury_balance
            .checked_sub(bot_amount)
            .ok_or(FractionError::ArithmeticOverflow)?;

        let signer_seeds = &[
            b"fraction_config",
            self.fraction_config.authority.as_ref(),
            self.fraction_config.name.as_ref(),
            &[self.fraction_config.bump],
        ];
        let signer = &[&signer_seeds[..]];

        if bot_amount > 0 {
            transfer_checked(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    TransferChecked {
                        from: self.treasury.to_account_info(),
                        mint: self.treasury_mint.to_account_info(),
                        to: self.bot_token_account.to_account_info(),
                        authority: self.fraction_config.to_account_info(),
                    },
                    signer,
                ),
                bot_amount,
                self.treasury_mint.decimals,
            )?;
        }

        let participant_token_accounts = [
            &self.participant_token_account_0,
            &self.participant_token_account_1,
            &self.participant_token_account_2,
            &self.participant_token_account_3,
            &self.participant_token_account_4,
        ];

        for (i, participant_token_account) in participant_token_accounts.into_iter().enumerate() {
            let participant_wallet = self.fraction_config.participants[i].wallet;
            let share_bps = self.fraction_config.participants[i].share_bps as u64;
            
            // Skip if participant wallet is the system program AND has non-zero share
            if participant_wallet == anchor_lang::system_program::ID && share_bps > 0 {
                continue;
            }
            
            if share_bps > 0 {
                let participant_share = participant_total
                    .checked_mul(share_bps)
                    .and_then(|x| x.checked_div(10_000))
                    .ok_or(FractionError::ArithmeticOverflow)?;
                    
                if participant_share > 0 {
                    transfer_checked(
                        CpiContext::new_with_signer(
                            self.token_program.to_account_info(),
                            TransferChecked {
                                from: self.treasury.to_account_info(),
                                mint: self.treasury_mint.to_account_info(),
                                to: participant_token_account.to_account_info(),
                                authority: self.fraction_config.to_account_info(),
                            },
                            signer,
                        ),
                        participant_share,
                        self.treasury_mint.decimals,
                    )?;
                }
            }
        }
        Ok(())
    }
}
