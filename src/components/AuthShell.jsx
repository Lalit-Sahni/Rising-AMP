import React from 'react';
import { Check, FileText, Home } from 'lucide-react';
import BrandMark from './BrandMark';

const SIGNIN_STACK = {
  tag: (
    <>
      Know where every dollar goes, and <span className="text-[#F2A176]">what needs you today.</span>
    </>
  ),
  trust: 'Built on a site, for people who work on them. Your numbers, read back in plain English.',
};

const SIGNUP_STACK = {
  tag: (
    <>
      Turn your receipts into <span className="text-[#F2A176]">a business you can see.</span>
    </>
  ),
  trust: 'Every expense, every invoice, every job, and the one number that matters: are you making money.',
};

function MiniCard({ className, children }) {
  return (
    <div className={`absolute top-0 left-0 w-[250px] bg-white text-ink rounded-[14px] p-4 origin-bottom-right ${className}`}>
      {children}
    </div>
  );
}

function SignInCards() {
  return (
    <div className="absolute top-[132px] right-12 w-[250px] h-[250px]">
      <MiniCard className="bg-[#FBFBFC] z-[1] shadow-[0_22px_44px_rgba(0,0,0,.32)] -translate-x-[236px] -translate-y-16 -rotate-[11deg] scale-[0.93]">
        <div className="flex items-center gap-2.5">
          <span className="w-[30px] h-[30px] rounded-[8px] bg-canvas border border-hairline text-slate-600 grid place-items-center shrink-0">
            <FileText className="w-[15px] h-[15px]" strokeWidth={1.7} />
          </span>
          <div>
            <b className="block text-[13px] font-extrabold">Invoices</b>
            <small className="block text-[11px] text-slate-400">Nothing overdue</small>
          </div>
          <span className="ml-auto text-[11px] font-bold text-pos bg-pos-tint px-2 py-0.5 rounded-full">All paid</span>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs">
          <span className="text-slate-500">Invoiced</span>
          <span className="tabular font-bold">$388,000</span>
        </div>
      </MiniCard>
      <MiniCard className="z-[2] shadow-[0_24px_48px_rgba(0,0,0,.34)] -translate-x-[120px] -translate-y-8 -rotate-6 scale-[0.965]">
        <div className="flex items-center gap-2.5">
          <span className="w-[30px] h-[30px] rounded-[8px] bg-pos-tint text-pos grid place-items-center shrink-0">
            <Check className="w-[15px] h-[15px]" strokeWidth={2.2} />
          </span>
          <div>
            <b className="block text-[13px] font-extrabold">Receipt saved</b>
            <small className="block text-[11px] text-slate-400">Northside</small>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs">
          <span className="text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-c-materials" style={{ background: 'var(--c-materials)' }} />
            Materials
          </span>
          <span className="tabular font-bold">$186.40</span>
        </div>
      </MiniCard>
      <MiniCard className="z-[3] shadow-[0_28px_56px_rgba(0,0,0,.40)] -rotate-2">
        <div className="flex items-center gap-2.5">
          <span className="w-[30px] h-[30px] rounded-[8px] bg-pos-tint text-pos grid place-items-center shrink-0">
            <Check className="w-[15px] h-[15px]" strokeWidth={2.2} />
          </span>
          <div>
            <b className="block text-[13px] font-extrabold">Ridge Road Pavilion</b>
            <small className="block text-[11px] text-slate-400">On track</small>
          </div>
        </div>
        <div className="text-[11px] text-slate-400 font-semibold mt-3.5">Margin</div>
        <div className="tabular text-2xl font-extrabold tracking-tight mt-0.5">
          $48,260 <span className="text-[13px] text-pos font-bold">12.4%</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {[
            ['Materials', '100%', 'var(--c-materials)'],
            ['Trade', '74%', 'var(--c-trade)'],
            ['Labour', '41%', 'var(--c-labour)'],
          ].map(([label, width, color]) => (
            <div key={label} className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="w-14">{label}</span>
              <span className="flex-1 h-1.5 bg-[#EEF0F2] rounded overflow-hidden">
                <span className="block h-full rounded" style={{ width, background: color }} />
              </span>
            </div>
          ))}
        </div>
      </MiniCard>
    </div>
  );
}

function SignUpCards() {
  return (
    <div className="absolute top-[132px] right-12 w-[250px] h-[250px]">
      <MiniCard className="bg-[#FBFBFC] z-[1] shadow-[0_22px_44px_rgba(0,0,0,.32)] -translate-x-[236px] -translate-y-16 -rotate-[11deg] scale-[0.93]">
        <div className="flex items-center gap-2.5">
          <span className="w-[30px] h-[30px] rounded-[8px] bg-canvas border border-hairline text-slate-600 grid place-items-center shrink-0">
            <FileText className="w-[15px] h-[15px]" strokeWidth={1.7} />
          </span>
          <div>
            <b className="block text-[13px] font-extrabold">This month</b>
            <small className="block text-[11px] text-slate-400">Spend so far</small>
          </div>
        </div>
        <div className="tabular text-xl font-extrabold tracking-tight mt-3">$8,420</div>
      </MiniCard>
      <MiniCard className="z-[2] shadow-[0_24px_48px_rgba(0,0,0,.34)] -translate-x-[120px] -translate-y-8 -rotate-6 scale-[0.965]">
        <div className="flex items-center gap-2.5">
          <span className="w-[30px] h-[30px] rounded-[8px] bg-pos-tint text-pos grid place-items-center shrink-0">
            <Check className="w-[15px] h-[15px]" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <b className="block text-[13px] font-extrabold">Harbour Kitchen</b>
            <small className="block text-[11px] text-slate-400">Margin at risk</small>
          </div>
          <span className="ml-auto text-[11px] font-bold text-warn bg-warn-tint px-2 py-0.5 rounded-full">4.8%</span>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs">
          <span className="text-slate-500">Cost to date</span>
          <span className="tabular font-bold">$142,000</span>
        </div>
      </MiniCard>
      <MiniCard className="z-[3] shadow-[0_28px_56px_rgba(0,0,0,.40)] -rotate-2">
        <div className="flex items-center gap-2.5">
          <span className="w-[30px] h-[30px] rounded-[8px] bg-canvas border border-hairline text-slate-600 grid place-items-center shrink-0">
            <Home className="w-[15px] h-[15px]" strokeWidth={1.7} />
          </span>
          <div>
            <b className="block text-[13px] font-extrabold">3 jobs</b>
            <small className="block text-[11px] text-slate-400">All tracking</small>
          </div>
        </div>
        <div className="text-[11px] text-slate-400 font-semibold mt-3.5">Combined margin</div>
        <div className="tabular text-2xl font-extrabold tracking-tight mt-0.5">
          $64k <span className="text-[13px] text-pos font-bold">11.2%</span>
        </div>
        <div className="mt-3 space-y-1.5">
          {[
            ['Ridge Rd', '60%', 'var(--pos)'],
            ['Harbour', '22%', 'var(--warn)'],
            ['Mill St', '8%', 'var(--slate-400)'],
          ].map(([label, width, color]) => (
            <div key={label} className="flex items-center gap-2 text-[11px] text-slate-500">
              <span className="w-[74px] truncate">{label}</span>
              <span className="flex-1 h-1.5 bg-[#EEF0F2] rounded overflow-hidden">
                <span className="block h-full rounded" style={{ width, background: color }} />
              </span>
            </div>
          ))}
        </div>
      </MiniCard>
    </div>
  );
}

export default function AuthShell({ mode = 'signin', children }) {
  const copy = mode === 'signup' ? SIGNUP_STACK : SIGNIN_STACK;

  return (
    <div className="min-h-screen bg-surface text-ink flex">
      <div className="flex-1 flex flex-col px-6 py-8 sm:px-14 sm:py-[52px] max-w-[560px] mx-auto min-[860px]:mx-0 min-[860px]:max-w-none w-full min-h-screen">
        <div className="flex items-center gap-2.5 mb-8 max-[859px]:flex-col max-[859px]:mb-5">
          <span className="hidden min-[860px]:inline-grid">
            <BrandMark size={34} icon={19} />
          </span>
          <span className="min-[860px]:hidden">
            <BrandMark size={44} icon={22} />
          </span>
          <b className="text-base font-extrabold tracking-tight max-[859px]:hidden">RisingAMP</b>
        </div>
        <div className="my-auto w-full max-w-[360px] max-[859px]:mx-auto max-[859px]:flex-1 max-[859px]:flex max-[859px]:flex-col">
          {children}
        </div>
      </div>

      <div
        className="relative hidden min-[860px]:flex flex-1 flex-col overflow-hidden text-white p-12"
        style={{
          background: 'radial-gradient(120% 100% at 100% 0,#26303B 0%,#191B20 55%,#141518 100%)',
        }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-100"
          style={{
            backgroundImage: 'linear-gradient(#ffffff0d 1px,transparent 1px),linear-gradient(90deg,#ffffff0d 1px,transparent 1px)',
            backgroundSize: '34px 34px',
            WebkitMaskImage: 'radial-gradient(90% 80% at 60% 15%,#000 0%,transparent 75%)',
            maskImage: 'radial-gradient(90% 80% at 60% 15%,#000 0%,transparent 75%)',
          }}
        />
        <div className="relative flex items-center gap-2.5 font-extrabold text-[15px]">
          <BrandMark size={28} icon={16} />
          RisingAMP
        </div>
        {mode === 'signup' ? <SignUpCards /> : <SignInCards />}
        <div className="relative mt-auto max-w-[380px]">
          <div className="text-[27px] font-extrabold tracking-tight leading-tight">{copy.tag}</div>
          <p className="mt-[18px] text-[13px] text-[#98A0AA] max-w-[340px] leading-relaxed">{copy.trust}</p>
        </div>
      </div>
    </div>
  );
}

export function AuthField({ label, extra, hint, children }) {
  return (
    <div className="mb-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <label className="block text-[12.5px] font-semibold">{label}</label>
        {extra}
      </div>
      {children}
      {hint && <p className="text-[11.5px] text-slate-400 mt-1.5">{hint}</p>}
    </div>
  );
}

export function AuthInput({ lead, trail, ...props }) {
  return (
    <div className="flex items-center border border-hairline rounded-[10px] px-3 bg-white focus-within:border-accent focus-within:shadow-[0_0_0_3px_var(--accent-tint)]">
      {lead && <span className="mr-2.5 text-slate-400 grid place-items-center">{lead}</span>}
      <input
        className="flex-1 border-0 outline-none text-sm text-ink py-3 bg-transparent placeholder:text-slate-400"
        {...props}
      />
      {trail}
    </div>
  );
}
