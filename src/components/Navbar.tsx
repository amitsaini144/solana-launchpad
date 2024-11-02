"use client"

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { motion, useMotionValueEvent, useScroll } from "framer-motion";
import { useEffect, useRef, useState } from "react";


export default function Navbar() {
    const [isClient, setIsClient] = useState(false);
    const [hidden, setHidden] = useState(false)
    const { scrollY } = useScroll()
    const lastScrollY = useRef(0)

    useMotionValueEvent(scrollY, "change", (latest: number) => {
        const direction = latest - lastScrollY.current > 0 ? "down" : "up"

        if (direction === "down" && !hidden) setHidden(true)
        if (direction === "up" && hidden) setHidden(false)

        lastScrollY.current = latest
    })

    const variants = {
        visible: { y: 0 },
        hidden: { y: "-100%" },
    }

    useEffect(() => {
        setIsClient(true);
        setHidden(false)
    }, [])


    if (!isClient) {
        return <div className="flex items-center justify-center min-h-screen bg-black/90">
            <div className="text-center">
                <h1 className="text-4xl font-bold text-white">
                    Loading...
                </h1>
                <p className="text-gray-300">
                    Please wait while we load the page.
                </p>
            </div>
        </div>;
    }
    return (
        <motion.nav
            variants={variants}
            animate={hidden ? "hidden" : "visible"}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="flex justify-end p-6 fixed top-0 right-0 z-50 w-full backdrop-blur-md">
                <WalletMultiButton />
        </motion.nav>
    )
}