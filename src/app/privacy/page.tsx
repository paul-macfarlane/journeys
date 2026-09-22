import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { CONTACT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Privacy policy",
  description:
    "What Journeys stores about Authors and Participants, which cookies it sets, and how to reach us.",
};

// Plain language, and only what the app actually does. Every claim here
// maps to code: the account fields come from better-auth’s user table, the
// cookie names and lifetimes from src/lib/run-cookies.ts, the anonymity of
// a Run from the runner never linking one to an account. Change the code,
// change this page.
export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Journeys is a small, independent service for writing and walking
        branching, text-based journeys. This page says what it stores, why, and
        what it never does. It is written to be read, not skimmed past.
      </p>

      <h2>Two kinds of people</h2>
      <p>
        <strong>Authors</strong> sign in and write journeys.{" "}
        <strong>Participants</strong> walk a published journey from a link and
        never have an account. What we store is different for each.
      </p>

      <h2>What we store about Authors</h2>
      <ul>
        <li>
          Your name, email address, and profile picture, as Google or Discord
          shares them when you sign in. We use them to show you who you are
          signed in as and to let the other members of a project recognise you.
          We never see or store your password.
        </li>
        <li>
          The projects and journeys you create: their titles, descriptions,
          every step and choice, each published version, and which projects you
          are a member of.
        </li>
        <li>
          The runs of your published journeys, so you can see how they are
          walked. A run is never tied to a person; see below.
        </li>
      </ul>

      <h2>What we store about Participants</h2>
      <p>
        Nothing that identifies you. When you walk a published journey we record
        a <strong>run</strong>: which steps you visited, which choices you made,
        and, when a step asks you a question, the answer you type. A run holds
        no name, no email address, no account, and no IP address. Authors of the
        journey can read their runs, including the free-text answers, so do not
        type anything into a journey that you would not want its authors to
        read.
      </p>

      <h2>Cookies</h2>
      <p>
        Journeys sets cookies only to make the service work. None of them is
        used for advertising or for tracking you across other sites.
      </p>
      <ul>
        <li>
          <strong>Session cookie</strong> (Authors). Set when you sign in so
          that you stay signed in. Removed when you sign out or it expires.
        </li>
        <li>
          <strong>Participant cookie</strong> (Participants). A random id, set
          on the first choice you make in any journey, so that a journey can
          tell your walk apart from somebody else’s on the same device. It is
          scoped to journey pages, lasts up to 400 days, and is never linked to
          an account.
        </li>
        <li>
          <strong>Run cookie</strong> (Participants). One per journey you are
          walking, holding the id of that run so the journey can pick up where
          you left off. It lasts 30 days and is only ever sent to that journey’s
          pages.
        </li>
      </ul>
      <p>
        Your choice of light or dark theme is kept in your browser’s local
        storage, not in a cookie, and never leaves your device.
      </p>

      <h2>What we never do</h2>
      <ul>
        <li>We do not sell your data, and we do not show advertising.</li>
        <li>
          We do not share your data with anyone except the services that host
          Journeys, listed below, and then only as much as running the service
          requires.
        </li>
        <li>
          We do not use your journeys or runs to train models or for anything
          other than running Journeys.
        </li>
      </ul>

      <h2>Where it lives</h2>
      <p>
        The application runs on Vercel and the database is hosted by Neon.
        Sign-in is handled through Google and Discord; each provider’s own
        privacy policy covers what they do with your sign-in.
      </p>

      <h2>Deleting things</h2>
      <p>
        Deleting a journey removes its draft, every published version, and every
        run. Deleting a project removes everything in it. To delete your account
        and everything you own, email us at the address below and we will do it.
      </p>

      <h2>Changes</h2>
      <p>
        If this policy changes, the date at the top changes with it. A change
        that affects what we store will be noted on this page.
      </p>

      <h2>Contact</h2>
      <p>
        Questions, requests, or concerns:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
      </p>
    </LegalPage>
  );
}
