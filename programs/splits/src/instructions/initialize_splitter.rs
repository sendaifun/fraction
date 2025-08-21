use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};
use crate::states::*;
use crate::errors::*;

#[derive(Accounts)]
#[instruction(
    name: String, //Not Using as Seeds
    participants: [Participant; 5],
    treasury_mint: Pubkey, 
    bot_wallet: Pubkey,
    participant_wallet_0: Pubkey,//Each participant needs to pass there Wallet for Onchain Participant Balance Accounts
    participant_wallet_1: Pubkey,
    participant_wallet_2: Pubkey,
    participant_wallet_3: Pubkey,
    participant_wallet_4: Pubkey
)]
pub struct InitializeSplitter<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = SplitterConfig::LEN,
        seeds = [b"splitter_config", authority.key().as_ref()],
        bump
    )]
    pub splitter_config: Box<Account<'info, SplitterConfig>>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = treasury_mint,
        associated_token::authority = splitter_config,
        associated_token::token_program = token_program,
    )]
    pub treasury: InterfaceAccount<'info, TokenAccount>,

    //Can be Any Mint (Token2022)
    pub treasury_mint: InterfaceAccount<'info, Mint>,

    // Participant balances use participant wallet-based seeds
    #[account(
        init,
        payer = authority,
        space = ParticipantBalance::LEN,
        seeds = [b"balance", splitter_config.key().as_ref(), participant_wallet_0.as_ref()],
        bump
    )]
    pub participant_balance_0: Box<Account<'info, ParticipantBalance>>,

    #[account(
        init,
        payer = authority,
        space = ParticipantBalance::LEN,
        seeds = [b"balance", splitter_config.key().as_ref(), participant_wallet_1.as_ref()],
        bump
    )]
    pub participant_balance_1: Box<Account<'info, ParticipantBalance>>,

    #[account(
        init,
        payer = authority,
        space = ParticipantBalance::LEN,
        seeds = [b"balance", splitter_config.key().as_ref(), participant_wallet_2.as_ref()],
        bump
    )]
    pub participant_balance_2: Box<Account<'info, ParticipantBalance>>,

    #[account(
        init,
        payer = authority,
        space = ParticipantBalance::LEN,
        seeds = [b"balance", splitter_config.key().as_ref(), participant_wallet_3.as_ref()],
        bump
    )]
    pub participant_balance_3: Box<Account<'info, ParticipantBalance>>,

    #[account(
        init,
        payer = authority,
        space = ParticipantBalance::LEN,
        seeds = [b"balance", splitter_config.key().as_ref(), participant_wallet_4.as_ref()],
        bump
    )]
    pub participant_balance_4: Box<Account<'info, ParticipantBalance>>,

    #[account(
        init,
        payer = authority,
        space = ParticipantBalance::LEN,
        seeds = [b"bot_balance", splitter_config.key().as_ref()],
        bump
    )]
    pub bot_balance: Box<Account<'info, ParticipantBalance>>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> InitializeSplitter<'info> {
    pub fn initialize_splitter(
        &mut self,
        name: String,
        participants: [Participant; 5],
        treasury_mint: Pubkey,
        bot_wallet: Pubkey,
        _participant_wallet_0: Pubkey,
        _participant_wallet_1: Pubkey,
        _participant_wallet_2: Pubkey,
        _participant_wallet_3: Pubkey,
        _participant_wallet_4: Pubkey,
    ) -> Result<()> {
        // Validate name length
        require!(
            name.len() <= SplitterConfig::MAX_NAME_LENGTH,
            SplitsError::NameTooLong
        );

        let total_shares: u32 = participants.iter().map(|p| p.share_bps as u32).sum();
        require!(total_shares == 10_000, SplitsError::InvalidShareDistribution);

        //Just Validate the Individual Wallets
        require!(
            _participant_wallet_0 == participants[0].wallet,
            SplitsError::ParticipantWalletMismatch
        );
        require!(
            _participant_wallet_1 == participants[1].wallet,
            SplitsError::ParticipantWalletMismatch
        );
        require!(
            _participant_wallet_2 == participants[2].wallet,
            SplitsError::ParticipantWalletMismatch
        );
        require!(
            _participant_wallet_3 == participants[3].wallet,
            SplitsError::ParticipantWalletMismatch
        );
        require!(
            _participant_wallet_4 == participants[4].wallet,
            SplitsError::ParticipantWalletMismatch
        );

        // Check for duplicate participant wallets
        let participant_wallets = [
            participants[0].wallet,
            participants[1].wallet,
            participants[2].wallet,
            participants[3].wallet,
            participants[4].wallet,
        ];
        
        for i in 0..5 {
            for j in (i + 1)..5 {
                require!(
                    participant_wallets[i] != participant_wallets[j],
                    SplitsError::DuplicateParticipantWallet
                );
            }
        }

        // Ensure bot wallet is not one of the participant wallets
        require!(
            !participant_wallets.contains(&bot_wallet),
            SplitsError::BotWalletConflict
        );

        // Set the splitter config using set_inner
        self.splitter_config.set_inner(SplitterConfig {
            authority: self.authority.key(),
            name: name,//avoided expensive operation
            participants,
            treasury_mint,
            bot_wallet,
            incentive_bps: 200u8,
            total_collected: 0,
            bump: self.splitter_config.bump,
        });

        // Initialize ParticipantBalance accounts using set_inner
        // Initialization is Done in an Order
        for i in 0..5 {
            let participant_balance = match i {
                0 => &mut self.participant_balance_0,
                1 => &mut self.participant_balance_1,
                2 => &mut self.participant_balance_2,
                3 => &mut self.participant_balance_3,
                4 => &mut self.participant_balance_4,
                _ => unreachable!(),
            };
            
            participant_balance.set_inner(ParticipantBalance {
                splitter: self.splitter_config.key(),
                participant: participants[i].wallet,
                amount: 0,
                bump: participant_balance.bump,
            });
        }

        // Set the bot balance using set_inner
        self.bot_balance.set_inner(ParticipantBalance {
            splitter: self.splitter_config.key(),
            participant: bot_wallet,
            amount: 0,
            bump: self.bot_balance.bump,
        });
        Ok(())
    }
}