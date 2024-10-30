"use client";
import { createAssociatedTokenAccountInstruction, createInitializeMetadataPointerInstruction, createInitializeMintInstruction, createMintToInstruction, ExtensionType, getAssociatedTokenAddressSync, getMintLen, LENGTH_SIZE, TOKEN_2022_PROGRAM_ID, TYPE_SIZE, } from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { createInitializeInstruction, pack, TokenMetadata } from '@solana/spl-token-metadata';
import { UploadClient } from '@uploadcare/upload-client'
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useState } from "react";

export default function TokenForm() {
    const [name, setName] = useState("");
    const [symbol, setSymbol] = useState("");
    const [decimals, setDecimals] = useState(0);
    const [imageUrl, setImageUrl] = useState("");
    const [initialSupply, setInitialSupply] = useState(0);
    const [description, setDescription] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const { connection } = useConnection();
    const wallet = useWallet();
    const client = new UploadClient({ publicKey: process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY! });


    const createMetaData = async (name: string, symbol: string, image: string) => {
        const metaData = JSON.stringify({ name, symbol, image });
        const metaDataFile = new File([metaData], 'metadata.json', { type: 'application/json' });
        try {
            const result = await client.uploadFile(metaDataFile);
            return result.cdnUrl;
        } catch (e) {
            console.error('Failed to upload metadata', e);
            throw e;
        }
    };


    async function createToken(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault();
        if (!wallet.publicKey) return alert("Please connect your wallet");

        setIsLoading(true);

        try {
            const metadataUri = await createMetaData(
                name,
                symbol,
                imageUrl
            );

            const mintKeypair = Keypair.generate();

            const metadata: TokenMetadata = {
                mint: mintKeypair.publicKey,
                name,
                symbol,
                uri: metadataUri,
                additionalMetadata: []
            };

            const mintLen = getMintLen([ExtensionType.MetadataPointer]);
            const mintDataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;

            const lamports = await connection.getMinimumBalanceForRentExemption(mintLen + mintDataLen);

            const transaction = new Transaction().add(
                SystemProgram.createAccount({
                    fromPubkey: wallet.publicKey,
                    newAccountPubkey: mintKeypair.publicKey,
                    space: mintLen,
                    lamports,
                    programId: TOKEN_2022_PROGRAM_ID,
                }),
                createInitializeMetadataPointerInstruction(mintKeypair.publicKey, wallet.publicKey, mintKeypair.publicKey, TOKEN_2022_PROGRAM_ID),
                createInitializeMintInstruction(mintKeypair.publicKey, decimals, wallet.publicKey, null, TOKEN_2022_PROGRAM_ID),
                createInitializeInstruction({
                    programId: TOKEN_2022_PROGRAM_ID,
                    metadata: mintKeypair.publicKey,
                    updateAuthority: wallet.publicKey,
                    mint: mintKeypair.publicKey,
                    mintAuthority: wallet.publicKey,
                    name: metadata.name,
                    symbol: metadata.symbol,
                    uri: metadata.uri,
                }),

            );

            transaction.feePayer = wallet.publicKey;
            transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
            transaction.partialSign(mintKeypair);
            const tx = await wallet.sendTransaction(transaction, connection);

            console.log(tx);

            const associatedToken = getAssociatedTokenAddressSync(
                mintKeypair.publicKey,
                wallet.publicKey,
                false,
                TOKEN_2022_PROGRAM_ID,
            );

            console.log(`AssociatedToken ${associatedToken.toBase58()}`);

            const transaction2 = new Transaction().add(
                createAssociatedTokenAccountInstruction(
                    wallet.publicKey,
                    associatedToken,
                    wallet.publicKey,
                    mintKeypair.publicKey,
                    TOKEN_2022_PROGRAM_ID,
                ),
            );

            await wallet.sendTransaction(transaction2, connection);

            const transaction3 = new Transaction().add(
                createMintToInstruction(mintKeypair.publicKey, associatedToken, wallet.publicKey, initialSupply, [], TOKEN_2022_PROGRAM_ID)
            );

            await wallet.sendTransaction(transaction3, connection);

            console.log("Minted!")
        }
        catch (e) {
            console.log(e)
            setIsLoading(false);
            return alert("Something went wrong");
        }
    }

    return (
        <>
            <h1 className="text-4xl md:text-5xl font-bold text-center p-4">
                Solana Token Launchpad
            </h1>
            <div className="flex justify-center p-6 w-full max-w-xl rounded-md">
                <form onSubmit={createToken} className="flex flex-col items-center justify-center gap-2 w-full">
                    <div className="flex gap-2 w-full">
                        <input
                            onChange={(e) => setName(e.target.value)}
                            type="text"
                            className="border-2 border-black p-3 text-black focus:outline-none w-full rounded-md"
                            placeholder="Name"
                            required
                        />
                        <input
                            onChange={(e) => setSymbol(e.target.value)}
                            type="text"
                            className="border-2 border-black p-3 text-black focus:outline-none w-full rounded-md"
                            placeholder="Symbol"
                            required
                        />
                    </div>
                    <div className="flex gap-2 w-full">
                        <input
                            onChange={(e) => setDecimals(Number(e.target.value))}
                            min={1}
                            type="number"
                            className="border-2 border-black p-3 text-black focus:outline-none appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full rounded-md"
                            placeholder="Decimals"
                            required
                        />
                        <input
                            onChange={(e) => setInitialSupply(Number(e.target.value))}
                            min={1}
                            type="number"
                            className="border-2 border-black p-3 text-black focus:outline-none appearance-none [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none w-full rounded-md"
                            placeholder="Lamports"
                            required
                        />
                    </div>

                    <div className="flex flex-col w-full gap-3">
                        <input
                            onChange={(e) => setImageUrl(e.target.value)}
                            type="text"
                            className="border-2 border-black p-3 text-black focus:outline-none w-full rounded-md"
                            placeholder="Image URL"
                            required
                        />

                        <textarea
                            required
                            placeholder="Description"
                            onChange={(e) => setDescription(e.target.value)}
                            className="p-3 w-full h-20 resize-none rounded-md focus:outline-none text-black"
                        />
                    </div>



                    <button className="bg-[#512da8] text-white font-bold py-2 px-4 rounded w-full">
                        {isLoading ?
                            <motion.div
                                className="flex items-center justify-center"
                                animate={{ rotate: 360 }}
                                transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                            >
                                <Loader2 />
                            </motion.div>
                            :
                            "Create Token"
                        }
                    </button>
                </form>
            </div>

        </>
    )
}