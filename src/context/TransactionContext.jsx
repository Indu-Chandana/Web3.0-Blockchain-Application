import React, { useEffect, useState } from "react";
import { ethers } from 'ethers';

import { contractABI, contractAddress } from '../utils/constans';

export const TransactionContext = React.createContext();

const { ethereum } = window;

const getEthereumContract = () => {
    const provider = new ethers.providers.Web3Provider(ethereum);
    const signer = provider.getSigner();
    const transactionContract = new ethers.Contract(contractAddress, contractABI, signer);

    // console.log({
    //     provider,
    //     signer,
    //     transactionContract
    // })

    return transactionContract;
}

export const TransactionProvider = ({ children }) => {
    const [currentAccount, setCurrentAccount] = useState('');
    const [formData, setFormData] = useState({ addressTo: '', amount: '', keyword: '', message: ''});
    const [isLoading, setIsLoading] =  useState(false);
    const [transactionCount, setTransactionCount] = useState(localStorage.getItem('transactionCount'));
    const [transactions, setTransactions] = useState([])

    const handleChange = (e, name) => {
        setFormData((prevState) => ({ ...prevState, [name]: e.target.value}));
    }

    const getAllTransactions = async () => {
        try {
            if (!ethereum) return alert("Please install metamask"); // we cannot do any of this if the user hasn't installed metamask.

            const transactionContract =  getEthereumContract();
            const availableTransactions = await transactionContract.getAllTransactions(); // this is speacial function we created on our smart contract.

            const structuredTransactions = availableTransactions.map((transaction) => ({
                addressTo: transaction.receiver,
                addressFrom: transaction.sender,
                timestamp: new Date(transaction.timestamp.toNumber() * 1000).toLocaleString(),
                message: transaction.message,
                keyword: transaction.keyword,
                amount: parseInt(transaction.amount._hex) / (10 ** 18)
            }))
            setTransactions(structuredTransactions)
            console.log(structuredTransactions);
        } catch (error) {
            console.log(error);
        }
    }

    const checkIfWalletIsConnected = async () => {      // checking if a wallet is connected at the start          
        try {
            if (!ethereum) return alert("Please install metamask"); // we cannot do any of this if the user hasn't installed metamask.

            const accounts = await ethereum.request({ method: 'eth_accounts' });   // get metamask connected accounts

            if (accounts.length) {
                setCurrentAccount(accounts[0]);

                getAllTransactions();  // get all available transactions
            } else {
                console.log('No accounts found')
            }

            console.log('account', accounts);
        } catch (error) {
            console.log(error);

            throw new Error("No ethereum object.")
        }


    }

    const checkIfTransactionsExist = async () => {
        try {
            const transactionContract =  getEthereumContract();
            const transactionCount = await transactionContract.getTransactionCount();

            window.localStorage.setItem("transactionCount", transactionCount)
        } catch (error) {
            console.log(error);

            throw new Error("No ethereum object.")
        }
    }

    const connectWallet = async () => {   // connecting the account
        try {
            if (!ethereum) return alert("Please install metamask");

            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });

            setCurrentAccount(accounts[0]);
        } catch (error) {
            console.log(error);

            throw new Error("No ethereum object.")
        }
    }

    const sendTransaction = async () => {   // sending and storing transactions 
        try {
            if (!ethereum) return alert("Please install metamask");

            // get data from the form...
            const { addressTo, amount, keyword, message } = formData;
            const transactionContract =  getEthereumContract();
            const parsedAmount = ethers.utils.parseEther(amount);  // convert decimal -> GWEI or hexadecimal

            await ethereum.request({   // send ethereum one address to another 
                method: 'eth_sendTransaction',
                params: [{
                    from: currentAccount,
                    to: addressTo,
                    // all the values use in ethereum network are written in -> hexadecimal
                    gas: '0x5208',   // 21000 GWEI -> GWEI is a subunit of Ether -> like a cent is to american dollar
                    value: parsedAmount._hex,   // amount = 0.00001 this is decimal number. We need to conver this to GWEI or hexadecimal
                }]
            });

            // add to blockchain so that we store the transaction
            const transactionHash = await transactionContract.addToBlockchain(addressTo, parsedAmount, message, keyword);

            setIsLoading(true);
            console.log(`Loading - ${transactionHash.hash}`);
            await transactionHash.wait();
            setIsLoading(false);
            console.log(`Success - ${transactionHash.hash}`);

            const transactionCount = await transactionContract.getTransactionCount();

            setTransactionCount(transactionCount.toNumber());

            window.reload();
        } catch (error) {
            console.log(error);

            throw new Error("No ethereum object.")
        }
    }

    useEffect(() => {
        checkIfWalletIsConnected();
        checkIfTransactionsExist();
    }, [])

    return (
        <TransactionContext.Provider value={{ connectWallet, currentAccount, formData, setFormData, handleChange, sendTransaction, transactions, isLoading }}>
            {children}
        </TransactionContext.Provider>
    )
}