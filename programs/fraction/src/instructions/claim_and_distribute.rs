use crate::{errors::*, states::*};
use anchor_lang::prelude::*;
use anchor_lang::system_program::{create_account, CreateAccount};
use anchor_spl::token::{self, close_account, CloseAccount, InitializeAccount3};
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
        bump = fraction_config.bump,
        constraint = fraction_config.authority == authority.key() @ FractionError::InvalidAuthority,
        constraint = fraction_config.bot_wallet == bot_wallet.key() @ FractionError::InvalidBot,
    )]
    pub fraction_config: Box<Account<'info, FractionConfig>>,

    #[account(mut, associated_token::mint = treasury_mint, associated_token::authority = fraction_config, associated_token::token_program = token_program)]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    //Temporary account for handling wSOL distributions
    #[account(mut)]
    pub temp_wsol_account: Option<Signer<'info>>,

    pub treasury_mint: InterfaceAccount<'info, Mint>,
    //superfluous checks
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
        let bump = self.fraction_config.bump;

        let signer_seeds = &[
            b"fraction_config" as &[u8],
            authority_key.as_ref(),
            name.as_ref(),
            &[bump],
        ];
        let signer = &[&signer_seeds[..]];

        if self.treasury_mint.key() == WSOL_MINT {
            return self.handle_wsol_distribution(signer);
        }

        let treasury_balance = self.treasury.amount;
        require!(treasury_balance > 0, FractionError::NoFundsToDistribute);

        self.distribute_tokens(treasury_balance, &self.treasury.to_account_info(), signer)
    }

    fn handle_wsol_distribution(&mut self, signer: &[&[&[u8]]]) -> Result<()> {
        let treasury_balance = self.treasury.amount;
        require!(treasury_balance > 0, FractionError::NoFundsToDistribute);

        if self.temp_wsol_account.is_none() {
            return Err(FractionError::InvalidAccount.into());
        }

        let rent = Rent::get()?;
        let space = anchor_spl::token::TokenAccount::LEN;
        let lamports = rent.minimum_balance(space);

        create_account(
            CpiContext::new(
                self.system_program.to_account_info(),
                CreateAccount {
                    from: self.bot_wallet.to_account_info(),
                    to: self.temp_wsol_account.as_ref().unwrap().to_account_info(),
                },
            ),
            lamports,
            space as u64,
            &anchor_spl::token::ID,
        )?;

        // Initialize temporary account
        token::initialize_account3(CpiContext::new(
            self.token_program.to_account_info(),
            InitializeAccount3 {
                account: self.temp_wsol_account.as_ref().unwrap().to_account_info(),
                mint: self.treasury_mint.to_account_info(),
                authority: self.fraction_config.to_account_info(),
            },
        ))?;

        // Transfer entire balance to temporary account
        transfer_checked(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                TransferChecked {
                    from: self.treasury.to_account_info(),
                    mint: self.treasury_mint.to_account_info(),
                    to: self.temp_wsol_account.as_ref().unwrap().to_account_info(),
                    authority: self.fraction_config.to_account_info(),
                },
                signer,
            ),
            treasury_balance,
            self.treasury_mint.decimals,
        )?;

        // Distribute from temporary account
        self.distribute_tokens_from_temp_account(treasury_balance, signer)?;

        // Close temporary account and refund to bot wallet
        close_account(CpiContext::new_with_signer(
            self.token_program.to_account_info(),
            CloseAccount {
                account: self.temp_wsol_account.as_ref().unwrap().to_account_info(),
                destination: self.bot_wallet.to_account_info(),
                authority: self.fraction_config.to_account_info(),
            },
            signer,
        ))?;

        Ok(())
    }

    fn distribute_tokens(
        &mut self,
        treasury_balance: u64,
        source_account: &AccountInfo<'info>,
        signer: &[&[&[u8]]],
    ) -> Result<()> {
        self.perform_distribution(treasury_balance, source_account, signer)
    }

    fn distribute_tokens_from_temp_account(
        &mut self,
        treasury_balance: u64,
        signer: &[&[&[u8]]],
    ) -> Result<()> {
        let temp_account = self
            .temp_wsol_account
            .as_ref()
            .ok_or(FractionError::InvalidAccount)?
            .to_account_info();

        self.perform_distribution(treasury_balance, &temp_account, signer)
    }

    fn perform_distribution(
        &mut self,
        treasury_balance: u64,
        source_account: &AccountInfo<'info>,
        signer: &[&[&[u8]]],
    ) -> Result<()> {
        // Calculate bot amount
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
                        from: source_account.clone(),
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
                                from: source_account.clone(),
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
