"use client"

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useEffect, useState } from "react";


export default function Navbar() {
    const [isClient, setIsClient] = useState(false);


    useEffect(() => {
        setIsClient(true);
    }, []);

    if (!isClient) {
        return <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <h1 className="text-4xl font-bold">
                    Loading...
                </h1>
                <p className="text-gray-500">
                    Please wait while we load the page.
                </p>
            </div>
        </div>;
    }
    return (
        <nav className="flex justify-end p-6 fixed right-0">
            <WalletMultiButton />
        </nav>
    )
}