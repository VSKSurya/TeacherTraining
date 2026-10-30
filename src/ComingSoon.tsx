import './coming-soon.css';

type ComingSoonProps = { title: string };

export default function ComingSoon({ title }: ComingSoonProps) {
  return <main className="coming-soon-page" id="main-content">
    <section className="coming-soon-card" aria-labelledby="coming-soon-title">
      <p className="coming-soon-brand">Schoolnet Teacher Training</p>
      <span className="coming-soon-icon" aria-hidden="true">…</span>
      <h1 id="coming-soon-title">{title}</h1>
      <p className="coming-soon-status" role="status">Coming soon</p>
      <p className="coming-soon-copy">This page is being prepared. Please check back later.</p>
      <a className="coming-soon-back" href={`${import.meta.env.BASE_URL}login`}>Back to login</a>
    </section>
  </main>;
}
