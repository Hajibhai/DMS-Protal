import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Printer, X, Layout, Check, Palette, Minimize2, Sliders, Settings } from 'lucide-react';

export interface PrintOptions {
    orientation: 'portrait' | 'landscape';
    colorMode: 'color' | 'mono';
    fitToPaper: boolean;
    margins: 'none' | 'minimum' | 'standard';
    bgGraphics: boolean;
    highContrast: boolean;
}

interface PrintModalProps {
    isOpen: boolean;
    onClose: () => void;
    onPrint: (options: PrintOptions) => void;
    title?: string;
    defaultOrientation?: 'portrait' | 'landscape';
}

export const PrintModal: React.FC<PrintModalProps> = ({
    isOpen,
    onClose,
    onPrint,
    title = "Print Settings",
    defaultOrientation = 'portrait'
}) => {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape'>(defaultOrientation);
    const [colorMode, setColorMode] = useState<'color' | 'mono'>('color');
    const [fitToPaper, setFitToPaper] = useState<boolean>(true);
    
    // More options section visibility, and standard items
    const [showMoreOptions, setShowMoreOptions] = useState<boolean>(true);
    const [margins, setMargins] = useState<'none' | 'minimum' | 'standard'>('standard');
    const [bgGraphics, setBgGraphics] = useState<boolean>(true);
    const [highContrast, setHighContrast] = useState<boolean>(false);

    useEffect(() => {
        if (isOpen) {
            setOrientation(defaultOrientation);
        }
    }, [isOpen, defaultOrientation]);

    const handlePrintClick = () => {
        onClose();
        setTimeout(() => {
            onPrint({
                orientation,
                colorMode,
                fitToPaper,
                margins,
                bgGraphics,
                highContrast
            });
        }, 150);
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print print:hidden">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white w-full max-w-lg rounded-3xl border border-slate-100 shadow-2xl overflow-hidden flex flex-col"
                >
                    {/* Header */}
                    <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-brand-50 text-brand-600 rounded-2xl">
                                <Printer className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold text-slate-900">{title}</h3>
                                <p className="text-sm text-slate-500 font-semibold mt-0.5">Customise your printing settings before generating</p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-2 hover:bg-slate-100 rounded-xl text-slate-400 hover:text-slate-600 transition-colors shadow-inner"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Options Form */}
                    <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
                        {/* 1. Orientation Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Layout className="w-4 h-4 text-slate-400" />
                                Page Orientation
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setOrientation('portrait')}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                                        orientation === 'portrait' 
                                            ? 'border-brand-500 bg-brand-50/30 text-brand-700' 
                                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-base">Portrait</span>
                                        {orientation === 'portrait' && (
                                            <div className="p-1 bg-brand-500 text-white rounded-full">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Best for lists and single columns</p>
                                    <div className="mt-3 w-8 h-10 border border-current rounded mx-auto opacity-60 flex items-center justify-center font-mono text-[9px]">A4</div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setOrientation('landscape')}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                                        orientation === 'landscape' 
                                            ? 'border-brand-500 bg-brand-50/30 text-brand-700' 
                                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-base">Landscape</span>
                                        {orientation === 'landscape' && (
                                            <div className="p-1 bg-brand-500 text-white rounded-full">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Best for wide sheets & analytics</p>
                                    <div className="mt-3 w-12 h-8 border border-current rounded mx-auto opacity-60 flex items-center justify-center font-mono text-[9px]">A4</div>
                                </button>
                            </div>
                        </div>

                        {/* 2. Color Selection */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-slate-700 flex items-center gap-2">
                                <Palette className="w-4 h-4 text-slate-400" />
                                Color Palette
                            </label>
                            <div className="grid grid-cols-2 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setColorMode('color')}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                                        colorMode === 'color' 
                                            ? 'border-brand-500 bg-brand-50/30 text-brand-700' 
                                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-base">Full Color</span>
                                        {colorMode === 'color' && (
                                            <div className="p-1 bg-brand-500 text-white rounded-full">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Best for digital PDF sharing</p>
                                    <div className="mt-3 flex gap-1 justify-center">
                                        <div className="w-4 h-4 rounded-full bg-red-400" />
                                        <div className="w-4 h-4 rounded-full bg-blue-400" />
                                        <div className="w-4 h-4 rounded-full bg-emerald-400" />
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setColorMode('mono')}
                                    className={`p-4 rounded-2xl border-2 text-left transition-all relative ${
                                        colorMode === 'mono' 
                                            ? 'border-brand-500 bg-brand-50/30 text-brand-700' 
                                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-bold text-base">Black & White (Mono)</span>
                                        {colorMode === 'mono' && (
                                            <div className="p-1 bg-brand-500 text-white rounded-full">
                                                <Check className="w-3 h-3" />
                                            </div>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 mt-1">Saves ink, uses grayscale filters</p>
                                    <div className="mt-3 flex gap-1 justify-center">
                                        <div className="w-4 h-4 rounded-full bg-slate-300" />
                                        <div className="w-4 h-4 rounded-full bg-slate-500" />
                                        <div className="w-4 h-4 rounded-full bg-slate-700" />
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* 3. Fit to Paper options */}
                        <div className="p-4 bg-slate-50 rounded-2xl flex items-center justify-between border border-slate-100">
                            <div>
                                <label className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Minimize2 className="w-4 h-4 text-brand-600" />
                                    Fit to Paper Size
                                </label>
                                <p className="text-xs text-slate-500 font-semibold mt-0.5">Automatically scale down content to prevent edge cutting</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setFitToPaper(!fitToPaper)}
                                className={`w-12 h-6.5 rounded-full p-1 transition-colors duration-200 focus:outline-none ${
                                    fitToPaper ? 'bg-brand-600' : 'bg-slate-200'
                                }`}
                            >
                                <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-md transform transition-transform duration-200 ${
                                    fitToPaper ? 'translate-x-5.5' : 'translate-x-0'
                                }`} />
                            </button>
                        </div>

                        {/* 4. Collapsible Advanced Settings (Always visible/expanded as "more options visible below") */}
                        <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-sm">
                            <button
                                type="button"
                                onClick={() => setShowMoreOptions(!showMoreOptions)}
                                className="w-full p-4 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between text-left"
                            >
                                <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                    <Sliders className="w-4 h-4 text-brand-600" />
                                    More Options
                                </span>
                                <span className="text-xs text-brand-600 font-bold hover:underline">
                                    {showMoreOptions ? 'Hide' : 'Show'}
                                </span>
                            </button>

                            {showMoreOptions && (
                                <div className="p-4 space-y-4 bg-white animate-in fade-in duration-200">
                                    {/* Margins */}
                                    <div className="space-y-2">
                                        <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Page Margins</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {(['none', 'minimum', 'standard'] as const).map(m => (
                                                <button
                                                    key={m}
                                                    type="button"
                                                    onClick={() => setMargins(m)}
                                                    className={`py-2 px-3 text-xs rounded-xl font-bold border capitalize transition-all ${
                                                        margins === m 
                                                            ? 'border-brand-500 bg-brand-50/10 text-brand-600 shadow-sm' 
                                                            : 'border-slate-100 hover:border-slate-200 text-slate-600'
                                                    }`}
                                                >
                                                    {m}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Background Graphics */}
                                    <div className="flex items-center justify-between py-1.5 border-t border-slate-50">
                                        <div>
                                            <span className="text-xs font-bold text-slate-700">Print Background Graphics</span>
                                            <p className="text-[10px] text-slate-500">Includes background colors & custom visual cells</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setBgGraphics(!bgGraphics)}
                                            className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                                                bgGraphics ? 'bg-brand-600' : 'bg-slate-200'
                                            }`}
                                        >
                                            <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-sm transform transition-transform duration-200 ${
                                                bgGraphics ? 'translate-x-4.5' : 'translate-x-0'
                                            }`} />
                                        </button>
                                    </div>

                                    {/* High Contrast Mode */}
                                    <div className="flex items-center justify-between py-1.5 border-t border-slate-50">
                                        <div>
                                            <span className="text-xs font-bold text-slate-700">High Contrast Text styling</span>
                                            <p className="text-[10px] text-slate-500">Forces crisp text and strict solid black color</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setHighContrast(!highContrast)}
                                            className={`w-10 h-5.5 rounded-full p-0.5 transition-colors duration-200 focus:outline-none ${
                                                highContrast ? 'bg-brand-600' : 'bg-slate-200'
                                            }`}
                                        >
                                            <div className={`bg-white w-4.5 h-4.5 rounded-full shadow-sm transform transition-transform duration-200 ${
                                                highContrast ? 'translate-x-4.5' : 'translate-x-0'
                                            }`} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer buttons */}
                    <div className="p-6 border-t border-slate-50 flex items-center justify-end gap-3 bg-slate-50/30">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-600 hover:bg-slate-50 transition-all active:scale-95"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handlePrintClick}
                            className="flex items-center gap-2 px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl text-sm font-black transition-all active:scale-95 shadow-lg shadow-brand-600/25"
                        >
                            <Printer className="w-4 h-4" />
                            Print Now
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
