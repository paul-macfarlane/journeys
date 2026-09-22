import type { Metadata } from "next";

import { LegalPage } from "@/components/legal/legal-page";
import { CONTACT_EMAIL } from "@/lib/brand";

export const metadata: Metadata = {
  title: "Terms of service",
  description:
    "The terms for Authors who write and publish journeys on Journeys.",
};

// The terms bind Authors, who have accounts and publish things. A
// Participant agrees to nothing: walking a journey from a link is reading a
// page. Kept in plain language and kept short; a term nobody reads protects
// nobody.
export default function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms cover your use of Journeys as an Author: someone who signs
        in to write, publish, and share journeys. By signing in you agree to
        them. Participants, who walk a published journey from a link, do not
        need an account and are not bound by these terms.
      </p>

      <h2>Your account</h2>
      <ul>
        <li>
          You sign in with a Google or Discord account. Keep that account
          secure; what happens under your sign-in is your responsibility.
        </li>
        <li>You must be old enough to use the service where you live.</li>
        <li>
          You can stop using Journeys at any time. To have your account and
          everything you own deleted, email us.
        </li>
      </ul>

      <h2>Your journeys</h2>
      <ul>
        <li>
          What you write is yours. You keep every right to your journeys, and
          you give Journeys only the permission it needs to store them, show
          them to you and to the other members of your project, and deliver them
          to Participants when you publish.
        </li>
        <li>
          You are responsible for what you publish: that you have the right to
          use the text and any images you link to, and that it is lawful.
        </li>
        <li>
          Members of a project can read and edit everything in it, including
          your journeys and their runs. Add people you trust.
        </li>
      </ul>

      <h2>Participants’ runs</h2>
      <p>
        The runs of your published journeys are recorded anonymously and shown
        to the project’s members. A run may hold free-text answers a Participant
        typed. Treat them as what they are, words a stranger trusted you with:
        do not try to identify who wrote them, and do not publish them.
      </p>

      <h2>What you must not do</h2>
      <ul>
        <li>
          Publish anything unlawful, or anything that harasses, threatens, or
          defames a person.
        </li>
        <li>
          Use a journey to collect a Participant’s personal details, passwords,
          or payment information.
        </li>
        <li>
          Interfere with the service: probe it for weaknesses, overload it, or
          try to reach data that is not yours.
        </li>
      </ul>
      <p>
        We may remove content or suspend an account that breaks these terms. We
        will tell you why, at the email address on your account.
      </p>

      <h2>The service</h2>
      <p>
        Journeys is an independent project offered as it is, without any
        warranty. We work to keep it up and to keep your journeys safe, but we
        cannot promise it will always be available or free of mistakes, and we
        are not liable for loss that comes from using it, as far as the law
        allows. We may change or stop the service; if we stop it, we will give
        you notice and time to export your journeys.
      </p>

      <h2>Changes to these terms</h2>
      <p>
        If these terms change, the date at the top changes with it, and a change
        that matters to you will be noted on this page. Signing in after a
        change means you accept it.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about these terms, or anything else:{" "}
        <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>. If we ever
        disagree, we will try to sort it out by email first.
      </p>
    </LegalPage>
  );
}
