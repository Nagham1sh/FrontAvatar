import { AvatarViewer } from '../components/avatar/AvatarViewer';

export function AvatarCreator() {
  return (
    <main className="creator">
      <aside className="creator__panel">
        <h1>Create Avatar</h1>
        <p className="muted">Body controls arrive in Phase 4.</p>
      </aside>
      <section className="creator__stage">
        <AvatarViewer />
      </section>
    </main>
  );
}
