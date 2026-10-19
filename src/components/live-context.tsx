"use client";
import { createContext, useContext } from "react";
export const LiveContext = createContext(false);
export const useLiveRoom = () => useContext(LiveContext);
