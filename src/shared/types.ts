export interface IndexedEvent {
    token: string;
    spender: string;
    owner: string;
    allowance: string; // stringified bigint
    block: number;
    txHash: string;
}

export interface ScanProgress {
    network: string;
    lastBlock: number;
    updatedAt: Date;
}

export type NetworkId = 'testnet' | 'mainnet';
