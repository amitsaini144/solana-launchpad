"use client";
import {
    AuthorityType,
    createAssociatedTokenAccountInstruction,
    createInitializeMetadataPointerInstruction,
    createInitializeMintInstruction,
    createMintToInstruction,
    createSetAuthorityInstruction,
    ExtensionType,
    getAssociatedTokenAddressSync,
    getMintLen,
    LENGTH_SIZE,
    TOKEN_2022_PROGRAM_ID,
    TYPE_SIZE,
} from "@solana/spl-token";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
import { createInitializeInstruction, pack, TokenMetadata } from '@solana/spl-token-metadata';
import { UploadClient } from '@uploadcare/upload-client'
import { motion } from "framer-motion";
import { useState, useCallback, useMemo } from "react";
import { Switch } from "@/components/ui/switch"
import { toast } from "sonner";
import { useForm, Controller, Control } from "react-hook-form";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface TokenFormData {
    name: string;
    symbol: string;
    decimals: number;
    imageUrl: string;
    initialSupply: number;
    description: string;
    revokeFreezeAuth: boolean;
    revokeUpdateAuth: boolean;
    revokeMintAuth: boolean;
}

export default function TokenForm() {
    const { control, register, handleSubmit, reset, formState: { errors } } = useForm<TokenFormData>({
        defaultValues: {
            name: "",
            symbol: "",
            decimals: 6,
            imageUrl: "",
            initialSupply: 1,
            description: "",
            revokeFreezeAuth: false,
            revokeMintAuth: false,
        }
    });
    const [isLoading, setIsLoading] = useState(false);
    const [transaction, setTransaction] = useState<string | null>(null);
    const { connection } = useConnection();
    const wallet = useWallet();

    const uploadClient = useMemo(() =>
        new UploadClient({ publicKey: process.env.NEXT_PUBLIC_UPLOADCARE_PUBLIC_KEY! }),
        []);


    const createMetaData = useCallback(async (formData: TokenFormData) => {
        const { name, symbol, description, imageUrl } = formData;
        const metaData = JSON.stringify({ name, symbol, description, image: imageUrl });
        const metaDataFile = new File([metaData], 'metadata.json', { type: 'application/json' });

        try {
            const result = await uploadClient.uploadFile(metaDataFile);
            return result.cdnUrl;
        } catch (e) {
            console.error('Failed to upload metadata');
            throw e;
        }
    }, [uploadClient]);

    const onSubmit = async (formData: TokenFormData) => {
        if (!wallet.publicKey) {
            toast.error("Please connect your wallet");
            return;
        }
        setIsLoading(true);

        try {
            const metadataUri = await createMetaData(formData);
            const mintKeypair = Keypair.generate();

            const metadata: TokenMetadata = {
                mint: mintKeypair.publicKey,
                name: formData.name,
                symbol: formData.symbol,
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
                createInitializeMetadataPointerInstruction(
                    mintKeypair.publicKey,
                    wallet.publicKey,
                    mintKeypair.publicKey,
                    TOKEN_2022_PROGRAM_ID
                ),
                createInitializeMintInstruction(
                    mintKeypair.publicKey,
                    formData.decimals,
                    wallet.publicKey,
                    formData.revokeFreezeAuth ? null : wallet.publicKey,
                    TOKEN_2022_PROGRAM_ID
                ),
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

            toast.info("Minting Tokens");
            const associatedToken = getAssociatedTokenAddressSync(
                mintKeypair.publicKey,
                wallet.publicKey,
                false,
                TOKEN_2022_PROGRAM_ID,
            );

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
                createMintToInstruction(
                    mintKeypair.publicKey,
                    associatedToken,
                    wallet.publicKey,
                    formData.initialSupply,
                    [],
                    TOKEN_2022_PROGRAM_ID)
            );

            await wallet.sendTransaction(transaction3, connection);

            if (formData.revokeUpdateAuth || formData.revokeMintAuth) {
                toast.info("Updating Authority");
                const transaction4 = new Transaction();

                if (formData.revokeMintAuth) {
                    transaction4.add(
                        createSetAuthorityInstruction(
                            mintKeypair.publicKey,
                            wallet.publicKey,
                            AuthorityType.MintTokens,
                            null,
                            [],
                            TOKEN_2022_PROGRAM_ID
                        )
                    );
                }

                await wallet.sendTransaction(transaction4, connection);
                toast.success("Authority Updated Successfully");
            }
            toast.success("Tokens Minted Successfully");
            setTransaction(tx);
            setIsLoading(false)
            reset()
        }
        catch (e) {
            console.error(e)
            toast.error("Failed to create token");
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen p-4 bg-gradient-to-b form-purple-900 to-black">
            <div className="max-w-2xl mx-auto space-y-8 pt-32 pb-24">
                <header className="text-center space-y-6">
                    <h1 className="text-4xl md:text-5xl font-bold text-white">
                        Solana Token Launchpad
                    </h1>
                    <p className="text-gray-300">
                        Create your own Solana token in seconds
                    </p>
                </header>

                <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="space-y-6 bg-white/5 backdrop-blur-sm p-6 rounded-xl"
                >
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-4">
                            <label className="text-sm text-white">Name</label>
                            <input
                                {...register("name", { required: "Name is required" })}
                                className={cn(
                                    "w-full px-4 py-2 rounded-lg bg-white/10 border focus:ring-purple-500 text-white",
                                    errors.name && "border-red-500"
                                )}
                            />
                            {errors.name && <span className="text-xs text-red-500">{errors.name.message}</span>}
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm text-white">Symbol</label>
                            <input
                                {...register("symbol", { required: "Symbol is required" })}
                                className={cn(
                                    "w-full px-4 py-2 rounded-lg bg-white/10 border focus:ring-purple-500 text-white",
                                    errors.symbol && "border-red-500"
                                )}
                            />
                            {errors.symbol && <span className="text-xs text-red-500">{errors.symbol.message}</span>}
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm text-white">Decimals</label>
                            <input
                                type="number"
                                {...register("decimals", {
                                    required: "Decimals is required",
                                    min: {
                                        value: 1,
                                        message: "Decimals must be at least 1"
                                    },
                                    max: {
                                        value: 9,
                                        message: "Decimals must be at most 9"
                                    },
                                    valueAsNumber: true,
                                })}
                                className={cn(
                                    "w-full px-4 py-2 rounded-lg bg-white/10 border focus:ring-purple-500 text-white",
                                    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                    errors.decimals && "border-red-500"
                                )}

                            />
                            {errors.decimals && <span className="text-xs text-red-500">{errors.decimals.message}</span>}
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm text-white">Supply</label>
                            <input
                                type="number"
                                {...register("initialSupply", {
                                    required: "Supply is required",
                                    min: {
                                        value: 1,
                                        message: "Supply must be at least 1"
                                    },
                                    valueAsNumber: true,
                                })}
                                className={cn(
                                    "w-full px-4 py-2 rounded-lg bg-white/10 border focus:ring-purple-500 text-white",
                                    "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
                                    errors.initialSupply && "border-red-500"
                                )}
                            />
                            {errors.initialSupply && <span className="text-xs text-red-500">{errors.initialSupply.message}</span>}
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm text-white">Image URL</label>
                            <textarea
                                {...register("imageUrl", { required: "imageUrl is required" })}
                                className={cn(
                                    "w-full h-20 px-4 py-2 rounded-lg bg-white/10 border focus:ring-purple-500 text-sm text-white resize-none",
                                    errors.imageUrl && "border-red-500"
                                )}
                            />
                            {errors.imageUrl && <span className="text-xs text-red-500">{errors.imageUrl.message}</span>}
                        </div>

                        <div className="space-y-4">
                            <label className="text-sm text-white">Description</label>
                            <textarea
                                {...register("description", { required: "Description is required" })}
                                className={cn(
                                    "w-full h-20 px-4 py-2 rounded-lg bg-white/10 border focus:ring-purple-500 text-sm text-white resize-none",
                                    errors.description && "border-red-500"
                                )}
                            />
                            {errors.description && <span className="text-xs text-red-500">{errors.description.message}</span>}
                        </div>

                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        <AuthorityToggle
                            label="Revoke Freeze Authority"
                            description="Freeze Authority allows you to freeze token accounts"
                            name="revokeFreezeAuth"
                            control={control}
                        />
                        <AuthorityToggle
                            label="Revoke Mint Authority"
                            description="Mint Authority allows you to mint more supply"
                            name="revokeMintAuth"
                            control={control}
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={isLoading}
                        className={cn(
                            "w-full py-3 px-4 rounded-lg bg-purple-600 text-white font-medium flex justify-center",
                            "hover:bg-purple-700 transition-colors",
                            "disabled:opacity-50 disabled::cursor-not-allowed",
                        )}
                    >
                        {isLoading ? (
                            <div className="flex gap-4">
                                <motion.div
                                    className="flex items-center justify-center gap-2 w-fit"
                                    animate={{ rotate: 360 }}
                                    transition={{ repeat: Infinity, duration: 0.8 }}
                                >
                                    <div className="w-5 h-5 border-t-2 border-white rounded-full animate-spin" />
                                </motion.div>
                                <p>Creating Token...</p>
                            </div>

                        ) : (
                            "Create Token"
                        )}
                    </button>
                </form>
                {transaction &&
                    <div className="flex items-center justify-center">
                        <Link href={`https://explorer.solana.com/tx/${transaction}?cluster=devnet`} target="_blank">
                            <p className="text-blue-500 hover:underline text-sm">View Transaction</p>
                        </Link>
                    </div>}
            </div>
        </div>
    )
}

function AuthorityToggle({ label, description, name, control }: {
    label: string;
    description: string;
    name: keyof TokenFormData;
    control: Control<TokenFormData>;
}) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-medium text-white">{label}</label>
            <p className="text-xs text-gray-400">{description}</p>
            <Controller
                name={name}
                control={control}
                render={({ field: { onChange, value } }) => (
                    <Switch
                        checked={value as boolean}
                        onCheckedChange={onChange}
                    />
                )}
            />
        </div>
    );
}