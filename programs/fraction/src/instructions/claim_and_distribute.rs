use crate::{errors::*, states::*};
use anchor_lang::prelude::*;
use anchor_spl::token::{sync_native, SyncNative};
use anchor_spl::token_interface::{
    transfer_checked, Mint, TokenAccount, TokenInterface, TransferChecked,
};
pub const WSOL_MINT: Pubkey = anchor_spl::token::spl_token::native_mint::id();

#[derive(Accounts)]
pub struct ClaimAndDistribute<'info> {
    #[account(mut)]
    pub bot_wallet: Signer<'info>,

    /// CHECK:
    pub authority: UncheckedAccount<'info>,
    
    #[account(
        mut,
        seeds = [b"fraction_config", fraction_config.authority.key().as_ref(), fraction_config.name.as_ref()],
        bump = fraction_config.config_bump,
        constraint = fraction_config.authority == authority.key() @ FractionError::InvalidAuthority,
        constraint = fraction_config.bot_wallet == bot_wallet.key() @ FractionError::InvalidBot,
    )]
    pub fraction_config: Account<'info, FractionConfig>,

    #[account(
        mut,
        seeds = [b"fraction_vault", fraction_config.authority.key().as_ref(), fraction_config.name.as_ref()],
        bump = fraction_config.vault_bump,
    )]
    pub fraction_vault: SystemAccount<'info>,

    #[account(
        mut, 
        associated_token::mint = treasury_mint, 
        associated_token::authority = fraction_vault,
        associated_token::token_program = token_program
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    pub treasury_mint: InterfaceAccount<'info, Mint>,
    
    #[account(mut, token::mint = treasury_mint.key(),constraint = bot_token_account.owner == bot_wallet.key() @ FractionError::InvalidAccount)]
    pub bot_token_account: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = treasury_mint.key(),constraint = participant_token_account_0.owner == fraction_config.participants[0].wallet @ FractionError::InvalidAccount)]
    pub participant_token_account_0: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = treasury_mint.key(),constraint = participant_token_account_1.owner == fraction_config.participants[1].wallet @ FractionError::InvalidAccount)]
    pub participant_token_account_1: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = treasury_mint.key(),constraint = participant_token_account_2.owner == fraction_config.participants[2].wallet @ FractionError::InvalidAccount)]
    pub participant_token_account_2: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = treasury_mint.key(),constraint = participant_token_account_3.owner == fraction_config.participants[3].wallet @ FractionError::InvalidAccount)]
    pub participant_token_account_3: Box<InterfaceAccount<'info, TokenAccount>>,
    #[account(mut, token::mint = treasury_mint.key(),constraint = participant_token_account_4.owner == fraction_config.participants[4].wallet @ FractionError::InvalidAccount)]
    pub participant_token_account_4: Box<InterfaceAccount<'info, TokenAccount>>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

impl<'info> ClaimAndDistribute<'info> {
    pub fn claim_and_distribute(&mut self) -> Result<()> {
        let authority_key = self.fraction_config.authority.key();
        let name = self.fraction_config.name.clone();
        let vault_bump = self.fraction_config.vault_bump;

        let vault_signer_seeds = &[
            b"fraction_vault",
            authority_key.as_ref(),
            name.as_ref(),
            &[vault_bump],
        ];
        let vault_signer = &[&vault_signer_seeds[..]];

        if self.treasury_mint.key() == WSOL_MINT {
            let sol_balance = self.treasury.to_account_info().lamports();
            require!(sol_balance > 0, FractionError::NoFundsToDistribute);
            self.sync_native()?;
        }

        let treasury_balance = self.treasury.amount;
        require!(treasury_balance > 0, FractionError::NoFundsToDistribute);
        return self.perform_token_distribution(treasury_balance, vault_signer);
    }

    fn sync_native(&self) -> Result<()> {
        let cpi_accounts = SyncNative {
            account: self.treasury.to_account_info(),
        };
        let cpi_program = self.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        sync_native(cpi_ctx)?;
        Ok(())
    }

    fn perform_token_distribution(&self, treasury_balance: u64, vault_signer: &[&[&[u8]]]) -> Result<()> {
        let bot_amount = treasury_balance
            .checked_mul(self.fraction_config.incentive_bps as u64)
            .and_then(|x| x.checked_div(10_000))
            .ok_or(FractionError::ArithmeticOverflow)?;

        let participant_total = treasury_balance
            .checked_sub(bot_amount)
            .ok_or(FractionError::ArithmeticOverflow)?;

        if bot_amount > 0 {
            transfer_checked(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    TransferChecked {
                        from: self.treasury.to_account_info(),
                        mint: self.treasury_mint.to_account_info(),
                        to: self.bot_token_account.to_account_info(),
                        authority: self.fraction_vault.to_account_info(),
                    },
                    vault_signer,
                ),
                bot_amount,
                self.treasury_mint.decimals,
            )?;
        }

        let participant_accounts = [
            &self.participant_token_account_0,
            &self.participant_token_account_1,
            &self.participant_token_account_2,
            &self.participant_token_account_3,
            &self.participant_token_account_4,
        ];

        for (i, participant_token_account) in participant_accounts.into_iter().enumerate() {
            let participant_wallet = self.fraction_config.participants[i].wallet;
            let share_bps = self.fraction_config.participants[i].share_bps as u64;

            if participant_wallet == anchor_lang::system_program::ID && share_bps > 0 {
                return Err(FractionError::SystemProgramParticipant.into());
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
                                authority: self.fraction_vault.to_account_info(),
                            },
                            vault_signer,
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
