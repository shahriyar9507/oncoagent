import { LoginForm } from "@/components/LoginForm";
import { DatourMark, DatourWord } from "@/components/Logo";

export const metadata = { title: "Sign in · OncoAgent" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return (
    <div className="login">
      <section className="login-brand">
        <div className="lb-top">
          <span className="product"><DatourMark size={30} /> <span>Onco<b>Agent</b></span></span>
          <span className="by">by <DatourWord /></span>
        </div>
        <div className="lb-mid">
          <p className="eyebrow">Agentic precision oncology · lung cancer first</p>
          <h1>AI proposes.<br /><b>The doctor decides.</b></h1>
          <ul className="lb-points">
            <li><span className="dot" /> Nine agents read the case, cite every source and calculate the dose.</li>
            <li><span className="dot" /> A safety-critic checks each claim before you see it.</li>
            <li><span className="dot" /> Every approval, change and rejection is signed into a hash-chained log.</li>
          </ul>
          <div className="lb-stats" aria-label="What is inside">
            <div><b>9</b><span>agents per case</span></div>
            <div><b>54</b><span>interaction rules</span></div>
            <div><b>34</b><span>regimens dosed</span></div>
            <div><b>SHA-256</b><span>signed audit</span></div>
          </div>
        </div>
        <p className="lb-foot">For oncologists and clinical staff. Research prototype, not a medical device. Demo patients are fictional; enter de-identified cases only.</p>
      </section>
      <section className="login-panel">
        <LoginForm next={next} />
      </section>
    </div>
  );
}
