import { PublicKey } from "@solana/web3.js";

export type Participant = {
    wallet: PublicKey;
    shareBps: number;
}

export type CreatorFractionInputArgs = {
    participants: Participant[],
    authority: PublicKey,
    name?: string,
    botWallet?: PublicKey,
}

export type UpdateFractionInputArgs = {
    participants: Participant[],
    botWallet?: PublicKey,
}

export type ClaimAndDistributeInputArgs = {
    config: PublicKey,
}

export type FractionConfig = {
    authority: PublicKey;
    name: string;
    participants: Participant[];
    botWallet: PublicKey;
    incentiveBps: number;
    bump: number;
}